import { NextResponse } from 'next/server'
import { fetchDataPlans } from '@/lib/actions/data'

/**
 * POST /api/whatsapp/data/plans
 *
 * Get all available data plans for a network with markup applied.
 * 
 * Body: { network: "MTN" | "GLO" | "AIRTEL" | "ETISALAT", planType?: string }
 * 
 * Response:
 * {
 *   success: true,
 *   network: "MTN",
 *   planTypes: [
 *     { id: "mtn_sme", label: "SME", plans: [...] },
 *     { id: "mtn_gifting", label: "Gifting", plans: [...] }
 *   ]
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const network = body?.network?.toUpperCase()

    if (!network || !['MTN', 'GLO', 'AIRTEL', 'ETISALAT'].includes(network)) {
      return NextResponse.json(
        { success: false, error: 'Invalid network. Use: MTN, GLO, AIRTEL, ETISALAT' },
        { status: 400 }
      )
    }

    // Fetch plans with markup for this network (all plan types)
    const result = await fetchDataPlans(network)

    if (!result.success || !result.plans) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch plans' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      network,
      planTypes: result.plans, // Already grouped by plan type with markup applied
    })
  } catch (error) {
    console.error('[v0] whatsapp data plans error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
