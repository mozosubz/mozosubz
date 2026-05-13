import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'

/**
 * POST /api/integrations/services/data/plans
 * 
 * Get data plans from all networks
 * 
 * Requires Connect Key in header: X-Connect-Key: <key>
 * 
 * Request body:
 * {
 *   "network": "MTN" | "GLO" | "AIRTEL" | "9MOBILE"
 * }
 * 
 * Response: Same as /api/gsubz/data/plans
 */
export async function POST(request: NextRequest) {
  try {
    // Verify Connect Key
    const context = await verifyConnectKey(request)
    if (!context) {
      return NextResponse.json(
        { success: false, error: 'Invalid or missing Connect Key' },
        { status: 401 },
      )
    }

    // Check permissions
    if (!context.permissions.includes('services')) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions for this operation' },
        { status: 403 },
      )
    }

    const body = await request.json()
    const { network } = body

    if (!network) {
      return NextResponse.json(
        { success: false, error: 'Network parameter is required' },
        { status: 400 },
      )
    }

    // Call the existing GSubz API internally
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/gsubz/data/plans`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ network }),
      },
    )

    const data = await response.json()

    return NextResponse.json(data, { status: response.status })
  } catch (err) {
    console.error('[INTEGRATION_DATA_PLANS] Error:', err)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
