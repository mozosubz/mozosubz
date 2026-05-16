import { NextRequest, NextResponse } from 'next/server'
import { v1AuthOrRespond } from '@/lib/middleware/v1-auth-helper'
import { generateRechargePins } from '@/lib/actions/recharge-pins'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  console.log('[V1-PINS-GENERATE] POST')

  try {
    const auth = await v1AuthOrRespond(request)
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      )
    }

    const body = await request.json().catch(() => ({} as any))
    const { network, value, number } = body || {}

    if (!network || !value || !number) {
      return NextResponse.json(
        { success: false, error: 'network, value, and number are required' },
        { status: 400 },
      )
    }

    // Look up the user's email so the receipt can be delivered.
    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('email')
      .eq('id', auth.userId)
      .maybeSingle()

    const result = await generateRechargePins(
      {
        network: String(network),
        value: String(value),
        number: String(number),
      },
      auth.userId,
      profile?.email || undefined,
    )

    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (error) {
    console.error('[V1-PINS-GENERATE] Error')
    return NextResponse.json(
      { success: false, error: 'Failed to generate pins' },
      { status: 500 },
    )
  }
}
