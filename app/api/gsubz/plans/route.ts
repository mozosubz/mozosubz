import { NextRequest, NextResponse } from 'next/server'
import { getDataPlans, getCablePlans } from '@/lib/api/gsubz'
import { maskProviderName, sanitizeProviderPayload } from '@/lib/utils/sanitize-provider'

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
        // Provider copy — mask the upstream brand before returning it.
        error: providerError ? maskProviderName(String(providerError)) : 'No plans available',
        plans: []
      })
    }
    
    // Ensure we return an array of plans
    const plans = plansData?.plans || []

    // The payload is spread straight into the response, so sanitize the whole
    // object: provider fields such as `service` and `PlanName` can carry the
    // brand name.
    return NextResponse.json(
      sanitizeProviderPayload({
        ...plansData,
        plans: plans,
        error: plans.length === 0 ? 'No plans available' : null,
      })
    )
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch plans', plans: [] },
      { status: 200 }
    )
  }
}

