import { NextRequest, NextResponse } from 'next/server'
import { getDataPlans, getCablePlans } from '@/lib/api/gsubz'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const service = searchParams.get('service')
    const type = searchParams.get('type')

    if (!service || !type) {
      return NextResponse.json(
        { error: 'Missing service or type parameter', plans: [] },
        { status: 400 }
      )
    }

    let plansData: any = null

    try {
      if (type === 'DATA') {
        plansData = await getDataPlans(service)
      } else if (type === 'CABLE' || type === 'ELECTRICITY') {
        plansData = await getCablePlans(service)
      }
    } catch (fetchError) {
      return NextResponse.json(
        { error: 'Failed to fetch plans', plans: [] },
        { status: 200 }
      )
    }

    // Handle error responses from the provider API
    if (!plansData || plansData.error || plansData.status === 'error') {
      return NextResponse.json({
        error: 'Plans unavailable right now',
        plans: []
      })
    }

    // Ensure we return an array of plans. Only expose the plan fields the UI
    // needs — never forward the raw provider payload to the browser.
    const plans = plansData?.plans || []

    return NextResponse.json({
      service: plansData?.service,
      fixedPrice: plansData?.fixedPrice,
      plans: plans,
      error: plans.length === 0 ? 'No plans available' : null
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch plans', plans: [] },
      { status: 200 }
    )
  }
}

