import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getExamPinPrices } from '@/lib/actions/exam-pins'
import { listEsimCountries, listEsimPackages } from '@/lib/actions/esim'
import { listSocialServices } from '@/lib/actions/social'

/**
 * Live plan catalogue for the admin pricing page.
 *
 * Data and cable plans come from /api/provider/plans; the newer services have
 * no equivalent public endpoint, so this route exposes their catalogues to
 * admins only. It returns the same `{ plans: [{ displayName, value, price }] }`
 * shape the pricing page already renders.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated', plans: [] }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Admin access required', plans: [] }, { status: 403 })
  }

  const category = request.nextUrl.searchParams.get('category')
  const country = request.nextUrl.searchParams.get('country')

  try {
    if (category === 'exam') {
      const boards = await getExamPinPrices(true)
      return NextResponse.json({
        plans: boards.map((b) => ({ displayName: b.label, value: b.id, price: String(b.price) })),
      })
    }

    if (category === 'esim-countries') {
      const countries = await listEsimCountries()
      return NextResponse.json({
        countries: countries.map((c) => ({ code: c.locationCodes, name: c.country })),
      })
    }

    if (category === 'esim') {
      if (!country) return NextResponse.json({ plans: [] })
      const packages = await listEsimPackages(country, true)
      return NextResponse.json({
        plans: packages.map((p) => ({ displayName: p.name, value: p.packageCode, price: String(p.price) })),
      })
    }

    if (category === 'social') {
      const services = await listSocialServices(true)
      return NextResponse.json({
        plans: services.map((s) => ({
          displayName: s.display_name,
          value: String(s.value),
          price: String(s.price),
        })),
      })
    }

    return NextResponse.json({ plans: [] })
  } catch (error) {
    console.error('[v0] pricing-plans error:', error)
    return NextResponse.json({ error: 'Failed to fetch plans', plans: [] }, { status: 200 })
  }
}
