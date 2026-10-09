import { NextRequest, NextResponse } from 'next/server'
import { getDataPlans, getCablePlans } from '@/lib/api/gsubz'
import { getExamPinPrices } from '@/lib/actions/exam-pins'
import { listSocialServices } from '@/lib/actions/social'
import { listEsimPackages, listEsimCountries } from '@/lib/actions/esim'

interface AdminPlan {
  displayName: string
  value: string
  price: string
}

/**
 * Plan catalogue for the admin API pricing page. Data and cable come from the
 * provider's plans endpoint; exam pins, eSIM and social are normalised into the
 * same { displayName, value, price } shape so the page can price them the same
 * way.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const service = searchParams.get('service')
    const type = searchParams.get('type')
    const country = searchParams.get('country')

    if (!service || !type) {
      return NextResponse.json(
        { error: 'Missing service or type parameter', plans: [] },
        { status: 400 }
      )
    }

    // eSIM countries are a separate lookup — the admin picks a country before
    // its packages can be priced.
    if (type === 'ESIM_COUNTRIES') {
      const countries = await listEsimCountries()
      return NextResponse.json({
        countries: countries.map((c) => ({ name: c.country, value: c.locationCodes, plans: c.plans })),
        plans: [],
      })
    }

    let plans: AdminPlan[] = []
    let fixedPrice: unknown

    if (type === 'DATA' || type === 'CABLE' || type === 'ELECTRICITY') {
      // The provider response is loosely typed (it can carry an `error`/`status`
      // field on failure), so read it as `any` like the original route did.
      let plansData: any = null
      try {
        plansData = type === 'DATA' ? await getDataPlans(service) : await getCablePlans(service)
      } catch {
        return NextResponse.json({ error: 'Plans unavailable right now', plans: [] })
      }
      if (!plansData || plansData.error || plansData.status === 'error') {
        return NextResponse.json({ error: 'Plans unavailable right now', plans: [] })
      }
      plans = (plansData?.plans || []) as AdminPlan[]
      fixedPrice = plansData?.fixedPrice
    } else if (type === 'EXAM') {
      const boards = await getExamPinPrices(true)
      plans = boards.map((board) => ({
        displayName: board.label,
        value: board.id,
        price: String(board.price),
      }))
    } else if (type === 'SOCIAL') {
      const services = await listSocialServices(true)
      plans = services.map((s) => ({
        displayName: s.display_name,
        value: String(s.value),
        price: String(s.price),
      }))
    } else if (type === 'ESIM') {
      if (!country) {
        return NextResponse.json({ error: 'Missing country for eSIM', plans: [] }, { status: 400 })
      }
      const packages = await listEsimPackages(country, true)
      plans = packages.map((p) => ({
        displayName: p.name,
        value: p.packageCode,
        price: String(p.price),
      }))
    }

    return NextResponse.json({
      service,
      fixedPrice,
      plans,
      error: plans.length === 0 ? 'No plans available' : null,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch plans', plans: [] },
      { status: 200 }
    )
  }
}
