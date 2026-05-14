import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { createServerClient } from '@/lib/supabase/server'

/**
 * GET /api/mozosubz/v1/services/balance
 */
export async function GET(request: NextRequest) {
  try {
    const keyVerification = await verifyConnectKey(request)
    if (!keyVerification.success) {
      return NextResponse.json(
        { success: false, error: keyVerification.error },
        { status: keyVerification.status || 401 },
      )
    }

    const client = await createServerClient()
    const { data: { user } } = await client.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 401 },
      )
    }

    const { data: wallet } = await client
      .from('wallets')
      .select('balance')
      .eq('user_id', user.id)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      balance: wallet?.balance || 0,
    })
  } catch (error) {
    console.error('[v0] Mozosubz balance error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
