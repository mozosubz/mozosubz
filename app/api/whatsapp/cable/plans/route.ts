import { NextResponse } from 'next/server'
import { fetchCablePlans } from '@/lib/actions/cable'

/**
 * POST /api/whatsapp/cable/plans
 *
 * Get all available cable subscription plans for a provider with markup applied.
 * 
 * Body: { provider: "DSTV" | "GOTV" | "STARTIMES" }
 * 
 * Response:
 * {
 *   success: true,
 *   provider: "DSTV",
 *   plans: [
 *     { id: "dstv_starter", label: "Starter", price: 2500, ... },
 *     { id: "dstv_family", label: "Family", price: 5000, ... }
 *   ]
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const provider = body?.provider?.toUpperCase()

    if (!provider || !['DSTV', 'GOTV', 'STARTIMES'].includes(provider)) {
      return NextResponse.json(
        { success: false, error: 'Invalid provider. Use: DSTV, GOTV, STARTIMES' },
        { status: 400 }
      )
    }

    // Fetch cable plans with markup
    const result = await fetchCablePlans(provider)

    if (!result.success || !result.plans) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch plans' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      provider,
      plans: result.plans, // Already has markup applied
    })
  } catch (error) {
    console.error('[v0] whatsapp cable plans error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
