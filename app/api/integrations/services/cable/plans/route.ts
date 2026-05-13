import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'

export async function POST(request: NextRequest) {
  try {
    const context = await verifyConnectKey(request)
    if (!context) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    if (!context.permissions.includes('services')) return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 })

    const body = await request.json()
    const { provider } = body

    if (!provider) return NextResponse.json({ success: false, error: 'provider is required' }, { status: 400 })

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/gsubz/cable/plans`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
        body: JSON.stringify({ provider }),
      },
    )

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (err) {
    console.error('[CABLE_PLANS] Error:', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
