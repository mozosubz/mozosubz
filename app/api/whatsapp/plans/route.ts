import { NextRequest, NextResponse } from 'next/server'
import { getDataPlans, getCablePlans } from '@/lib/api/gsubz'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const service = searchParams.get('service')?.toUpperCase()
    const type = searchParams.get('type')?.toUpperCase()

    if (!service) {
      return NextResponse.json(
        { error: 'Service parameter required (MTN, AIRTEL, GLO, 9MOBILE for DATA; DSTV, GOTV, STARTIMES for CABLE)' },
        { status: 400 }
      )
    }

    let plansResponse = null

    // Determine which API to call based on service and type
    if (type === 'DATA' || ['MTN', 'AIRTEL', 'GLO', '9MOBILE'].includes(service)) {
      plansResponse = await getDataPlans(`${service}_data`)
    } else if (type === 'CABLE' || ['DSTV', 'GOTV', 'STARTIMES'].includes(service)) {
      plansResponse = await getCablePlans(service)
    } else {
      // Try data plans by default
      plansResponse = await getDataPlans(`${service}_data`)
    }

    if (!plansResponse || !plansResponse.plans) {
      return NextResponse.json(
        { error: 'Service not found or no plans available' },
        { status: 404 }
      )
    }

    // Transform plans to include AI-friendly identifiers
    const transformedPlans = plansResponse.plans.map((plan: any) => ({
      displayName: plan.displayName,
      value: plan.value,
      price: plan.price,
      uniqueId: `${service.toLowerCase()}_${plan.value.toLowerCase().replace(/\s+/g, '_')}`,
    }))

    return NextResponse.json({
      service,
      type: plansResponse.PlanName || type || 'UNKNOWN',
      plans: transformedPlans,
    })
  } catch (error) {
    console.error('[v0] WhatsApp plans error:', error)
    return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 })
  }
}
