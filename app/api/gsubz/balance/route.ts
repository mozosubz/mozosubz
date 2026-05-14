import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  console.log('[GSUBZ-BALANCE] GET /balance')

  try {
    // Get user ID from headers (set by v1 endpoints)
    const userId = request.headers.get('X-User-ID')

    if (!userId) {
      console.warn('[GSUBZ-BALANCE] Missing user ID')
      return NextResponse.json(
        { success: false, error: 'User ID required' },
        { status: 400 },
      )
    }

    console.log(`[GSUBZ-BALANCE] Fetching balance for user: ${userId}`)

    const admin = createAdminClient()
    const { data: profile, error } = await admin
      .from('profiles')
      .select('wallet_balance')
      .eq('id', userId)
      .single()

    if (error || !profile) {
      console.error('[GSUBZ-BALANCE] Profile not found')
      return NextResponse.json(
        { success: false, error: 'User profile not found' },
        { status: 404 },
      )
    }

    console.log('[GSUBZ-BALANCE] Success')

    return NextResponse.json({
      success: true,
      balance: profile.wallet_balance || 0,
    })
  } catch (error) {
    console.error('[GSUBZ-BALANCE] Error')
    return NextResponse.json(
      { success: false, error: 'Failed to fetch balance' },
      { status: 500 },
    )
  }
}
