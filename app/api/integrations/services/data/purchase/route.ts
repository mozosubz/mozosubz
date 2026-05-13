import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'

/**
 * POST /api/integrations/services/data/purchase
 * 
 * Purchase data for a phone number
 * 
 * Requires Connect Key in header: X-Connect-Key: <key>
 * 
 * Request body:
 * {
 *   "network": "MTN",
 *   "plan_id": "mtn_sme_500",
 *   "recipient_phone": "09056458312"
 * }
 * 
 * Response: Transaction details with reference number
 */
export async function POST(request: NextRequest) {
  try {
    const context = await verifyConnectKey(request)
    if (!context) {
      return NextResponse.json(
        { success: false, error: 'Invalid or missing Connect Key' },
        { status: 401 },
      )
    }

    if (!context.permissions.includes('services')) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 },
      )
    }

    const body = await request.json()
    const { network, plan_id, recipient_phone } = body

    if (!network || !plan_id || !recipient_phone) {
      return NextResponse.json(
        { success: false, error: 'network, plan_id, and recipient_phone are required' },
        { status: 400 },
      )
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/gsubz/data/purchase`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ network, plan_id, recipient_phone }),
      },
    )

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (err) {
    console.error('[INTEGRATION_DATA_PURCHASE] Error:', err)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
