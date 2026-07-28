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
      } else if (type === 'CABLE') {
        plansData = await getCablePlans(service)
      }
    } catch (fetchError) {
      return NextResponse.json(
        { error: 'Failed to fetch plans from provider', plans: [] },
        { status: 200 }
      )
    }

    // Handle error responses from the provider API
    if (!plansData || plansData.error || plansData.status === 'error') {
      const providerError = plansData?.message || plansData?.error
      return NextResponse.json({
        error: providerError ? String(providerError) : 'No plans available',
        plans: []
      })
    }
    
    // Ensure we return an array of plans
    const plans = plansData?.plans || []

    return NextResponse.json({
      ...plansData,
      plans: plans,
      error: plans.length === 0 ? 'No plans available' : null,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch plans', plans: [] },
      { status: 200 }
    )
  }
}

