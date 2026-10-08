'use server'

import { createServerClient } from '@/lib/supabase/server'
import { MONNIFY_BASE_URL } from '@/lib/api/monnify-config'

const MONNIFY_AUTH_URL = `${MONNIFY_BASE_URL}/api/v1/auth/login`
const MONNIFY_API_URL = `${MONNIFY_BASE_URL}/api/v2`
const API_KEY = process.env.MONNIFY_API_KEY || ''
const SECRET_KEY = process.env.MONNIFY_SECRET_KEY || ''
const CONTRACT_CODE = process.env.MONNIFY_CONTRACT_CODE || ''

// ---------------------------------------------------------------------------
// In-memory access-token cache (per warm serverless instance).
//
// Monnify access tokens are valid for ~3600s. Previously every deposit hit
// the auth endpoint TWICE (once inside initTransaction, once inside
// initializePayment), adding ~300-800ms per deposit and burning auth quota
// for no reason. We cache the token with a 60s safety margin and dedupe
// concurrent cold-start callers behind a single in-flight promise so we
// don't fan out N parallel auth requests when a batch of users hits a
// freshly-warm function.
// ---------------------------------------------------------------------------
let cachedToken: { value: string; expiresAt: number } | null = null
let inFlightAuth: Promise<string | null> | null = null

// ---------------------------------------------------------------------------
// Shared fetch for all Monnify API calls.
//
// Monnify sits behind Cloudflare, which blocks Vercel's serverless egress IP
// ranges on api.monnify.com with 403 "Sorry, you have been blocked" (observed
// in production, 2026-10). We send a browser-like User-Agent and retry once
// after a delay, which covers transient rule matches.
// ---------------------------------------------------------------------------
const MONNIFY_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept': 'application/json',
}

function isCloudflareBlock(status: number, body: string): boolean {
  return status === 403 && body.includes('cloudflare') && body.includes('<html')
}

export async function monnifyFetch(
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string }
): Promise<Response> {
  const doFetch = () =>
    fetch(url, {
      method: init.method,
      headers: { ...MONNIFY_HEADERS, ...init.headers },
      body: init.body,
    })

  let response = await doFetch()

  if (isCloudflareBlock(response.status, await response.clone().text())) {
    console.warn('[MONNIFY] Cloudflare block detected, retrying once after delay')
    await new Promise((resolve) => setTimeout(resolve, 1500))
    response = await doFetch()
  }

  return response
}

async function fetchMonnifyAccessTokenUncached(): Promise<string | null> {
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

  const response = await monnifyFetch(MONNIFY_AUTH_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
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
    if (!token) {
      console.error('[MONNIFY] No access token in response')
      return null
    }
    cachedToken = {
      value: token,
      // Refresh 60s before real expiry to avoid edge-case rejections.
      expiresAt: Date.now() + (expiresInSec - 60) * 1000,
    }
    console.log('[MONNIFY] Auth successful, cached for', expiresInSec - 60, 's')
    return token
  } catch (parseError) {
    console.error('[MONNIFY] Failed to parse auth response:', parseError)
    return null
  }
}

/**
 * Get Monnify access token using Basic Auth.
 * Per Monnify docs: API_KEY as username, SECRET_KEY as password.
 *
 * Hot path: returns the cached token instantly (no network).
 * Cold path: makes one auth request, dedupes concurrent callers.
 */
export async function getMonnifyAccessToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value
  }
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

    const response = await monnifyFetch(`${MONNIFY_BASE_URL}/api/v1/merchant/transactions/init-transaction`, {
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

      // Per Monnify's docs: always confirm the returned values match what was
      // sent — bad actors can intercept and alter values such as the amount.
      const returnedAmount = Number(responseBody.amount)
      if (Number.isFinite(returnedAmount) && returnedAmount !== amount) {
        console.error('[MONNIFY] Init-transaction amount mismatch:', { requested: amount, returned: returnedAmount })
        return { success: false, error: 'Transaction amount verification failed' }
      }
      if (responseBody.paymentReference && responseBody.paymentReference !== `${paymentReference}|${userId}`) {
        console.error('[MONNIFY] Init-transaction paymentReference mismatch:', {
          sent: `${paymentReference}|${userId}`,
          returned: responseBody.paymentReference,
        })
        return { success: false, error: 'Transaction reference verification failed' }
      }

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

    const response = await monnifyFetch(`${MONNIFY_BASE_URL}/api/v1/merchant/bank-transfer/init-payment`, {
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
