'use server'

import { createServerClient } from '@/lib/supabase/server'

// Use production endpoints for both auth and API calls
const MONNIFY_AUTH_URL = 'https://api.monnify.com/api/v1/auth/login'
const MONNIFY_API_URL = 'https://api.monnify.com/api/v2'
const API_KEY = process.env.MONNIFY_API_KEY || ''
const SECRET_KEY = process.env.MONNIFY_SECRET_KEY || ''
const CONTRACT_CODE = process.env.MONNIFY_CONTRACT_CODE || ''

/**
 * Cached Monnify access token.
 *
 * Monnify access tokens are valid for 3600s (1 hour). Re-authenticating on
 * every deposit (and twice per deposit, since initTransaction and
 * initializePayment both call this) was adding ~300–800ms per request and
 * burning unnecessary auth quota.
 *
 * We hold the token in a module-level variable with a safety margin of
 * 60s before its declared expiry. A single in-flight promise dedupes
 * concurrent callers during the cold start so we don't fan out N parallel
 * auth requests when the first batch of users hits a warm function.
 *
 * Note: serverless instances are short-lived, so this is a per-instance
 * cache. That's fine — Monnify allows multiple valid tokens, and warm
 * instances will see the speedup; cold-start cost is unchanged.
 */
let cachedToken: { value: string; expiresAt: number } | null = null
let inFlightAuth: Promise<string | null> | null = null

async function fetchMonnifyAccessTokenUncached(): Promise<string | null> {
  // Validate credentials exist (never log credential values or prefixes)
  if (!API_KEY || !SECRET_KEY) {
    console.error('[MONNIFY] Missing API credentials', {
      hasApiKey: !!API_KEY,
      hasSecretKey: !!SECRET_KEY,
      hasContractCode: !!CONTRACT_CODE,
    })
    return null
  }

  const credentials = Buffer.from(`${API_KEY}:${SECRET_KEY}`).toString('base64')
  console.log('[MONNIFY] Authenticating')

  const response = await fetch(MONNIFY_AUTH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })

  const responseText = await response.text()
  if (!response.ok) {
    console.error('[MONNIFY] Auth failed:', response.status)
    return null
  }

  try {
    const data = JSON.parse(responseText) as any
    const token = data.responseBody?.accessToken
    // Monnify returns expiresIn in seconds; default to 50 minutes if absent.
    const expiresInSec = Number(data.responseBody?.expiresIn) || 3000
    if (!token) return null
    cachedToken = {
      value: token,
      // Refresh 60s before real expiry to avoid edge-case rejections.
      expiresAt: Date.now() + (expiresInSec - 60) * 1000,
    }
    return token
  } catch (parseError) {
    console.error('[MONNIFY] Failed to parse auth response:', parseError)
    return null
  }
}

export async function getMonnifyAccessToken(): Promise<string | null> {
  // Hot path: valid cached token.
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value
  }
  // Dedupe concurrent cold-start callers.
  if (inFlightAuth) return inFlightAuth
  inFlightAuth = (async () => {
    try {
      return await fetchMonnifyAccessTokenUncached()
    } catch (err) {
      console.error('[MONNIFY] Auth error:', err instanceof Error ? err.message : err)
      cachedToken = null
      return null
    } finally {
      inFlightAuth = null
    }
  })()
  return inFlightAuth
}



/**
 * Initialize transaction with Monnify to get a valid transaction reference
 * Must be called before init-payment
 * @param amount - Transaction amount in naira
 * @param description - Payment description
 * @param paymentReference - Your own unique payment reference
 * @param userId - User ID for tracking deposits
 * @param customerEmail - Customer email (required by Monnify)
 * @param customerName - Customer name (required by Monnify)
 */
export async function initTransaction(
  amount: number,
  description: string,
  paymentReference: string,
  userId: string,
  customerEmail: string,
  customerName: string
) {
  try {
    console.log('[MONNIFY] Initializing transaction:', { amount, description, paymentReference, userId })

    // Get Monnify access token
    const accessToken = await getMonnifyAccessToken()
    if (!accessToken) {
      console.error('[MONNIFY] Failed to get access token for transaction initialization')
      return { success: false, error: 'Failed to authenticate with Monnify' }
    }

    const requestBody = {
      amount,
      paymentDescription: description,
      paymentReference: `${paymentReference}|${userId}`, // Include userId for webhook tracking
      customerEmail,
      customerName,
      currencyCode: 'NGN',
      contractCode: CONTRACT_CODE,
      redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard`,
    }

    const response = await fetch('https://api.monnify.com/api/v1/merchant/transactions/init-transaction', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    const responseText = await response.text()
    console.log('[MONNIFY] Init-transaction response status:', response.status)

    if (!response.ok) {
      console.error('[MONNIFY] Init-transaction failed:', response.status, 'Response:', responseText)
      try {
        const errorData = JSON.parse(responseText)
        return { success: false, error: errorData.responseMessage || 'Failed to initialize transaction' }
      } catch {
        return { success: false, error: `Transaction initialization failed with status ${response.status}` }
      }
    }

    try {
      const data = JSON.parse(responseText) as any
      const responseBody = data.responseBody

      console.log('[MONNIFY] Transaction initialized successfully')

      return {
        success: true,
        transactionReference: responseBody.transactionReference,
        paymentLink: responseBody.checkoutUrl,
      }
    } catch (parseError) {
      console.error('[MONNIFY] Failed to parse init-transaction response:', parseError)
      return { success: false, error: 'Failed to parse transaction response' }
    }
  } catch (error) {
    console.error('[MONNIFY] Transaction initialization error:', error instanceof Error ? error.message : error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Initialize a one-time payment with dynamic account number
 * Generates a temporary account number for payment collection
 * @param transactionReference - Unique reference from initialize transaction endpoint
 * @param bankCode - Optional specific bank code for USSD generation
 */
export async function initializePayment(transactionReference: string, bankCode?: string) {
  try {
    console.log('[MONNIFY] Initializing payment for transaction:', transactionReference)

    // Get Monnify access token
    const accessToken = await getMonnifyAccessToken()
    if (!accessToken) {
      console.error('[MONNIFY] Failed to get access token for payment initialization')
      return { success: false, error: 'Failed to authenticate with Monnify' }
    }

    const requestBody: any = {
      transactionReference,
    }

    if (bankCode) {
      requestBody.bankCode = bankCode
    }

    const response = await fetch('https://api.monnify.com/api/v1/merchant/bank-transfer/init-payment', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    const responseText = await response.text()
    console.log('[MONNIFY] Payment initialization response status:', response.status)

    if (!response.ok) {
      console.error('[MONNIFY] Payment initialization failed:', response.status)
      try {
        const errorData = JSON.parse(responseText)
        return { success: false, error: errorData.responseMessage || 'Failed to initialize payment' }
      } catch {
        return { success: false, error: `Payment initialization failed with status ${response.status}` }
      }
    }

    try {
      const data = JSON.parse(responseText) as any
      const responseBody = data.responseBody

      console.log('[MONNIFY] Payment initialized successfully')

      return {
        success: true,
        accountNumber: responseBody.accountNumber,
        accountName: responseBody.accountName,
        bankName: responseBody.bankName,
        bankCode: responseBody.bankCode,
        ussdCode: responseBody.ussdCode,
      }
    } catch (parseError) {
      console.error('[MONNIFY] Failed to parse payment initialization response:', parseError)
      return { success: false, error: 'Failed to parse payment response' }
    }
  } catch (error) {
    console.error('[MONNIFY] Payment initialization error:', error instanceof Error ? error.message : error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
