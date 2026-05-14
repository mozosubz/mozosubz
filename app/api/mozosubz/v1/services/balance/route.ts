import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { createServerClient } from '@/lib/supabase/server'

/**
 * GET /api/mozosubz/v1/services/balance
 */
export async function GET(request: NextRequest) {
  console.log('[MOZOSUBZ-V1-BALANCE] Request started')
  try {
    console.log('[MOZOSUBZ-V1-BALANCE] Verifying connect key...')
    const keyVerification = await verifyConnectKey(request)
    console.log('[MOZOSUBZ-V1-BALANCE] Auth result:', keyVerification.success)
    
    if (!keyVerification.success) {
      console.warn('[MOZOSUBZ-V1-BALANCE] Auth failed:', keyVerification.error)
      return NextResponse.json(
        { success: false, error: keyVerification.error },
        { status: keyVerification.status || 401 },
      )
    }

    console.log('[MOZOSUBZ-V1-BALANCE] Authorized user:', keyVerification.context?.userId)

    const client = await createServerClient()
    const { data: { user } } = await client.auth.getUser()

    if (!user) {
      console.warn('[MOZOSUBZ-V1-BALANCE] User not found')
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 401 },
      )
    }

    console.log('[MOZOSUBZ-V1-BALANCE] Fetching wallet for user:', user.id)
    const { data: wallet } = await client
      .from('wallets')
      .select('balance')
      .eq('user_id', user.id)
      .maybeSingle()

    console.log('[MOZOSUBZ-V1-BALANCE] Wallet balance:', wallet?.balance || 0)
    
    return NextResponse.json({
      success: true,
      balance: wallet?.balance || 0,
    })
  } catch (error) {
    console.error('[MOZOSUBZ-V1-BALANCE] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
