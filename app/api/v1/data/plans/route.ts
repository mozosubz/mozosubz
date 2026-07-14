import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { createAdminClient } from '@/lib/supabase/admin'
import { getDataPlans } from '@/lib/api/gsubz'

/**
 * GET /api/v1/data/plans?service={service_id}
 *
 * Returns available data plans for a service with API-level pricing applied.
 * Requires X-Connect-Key header.
 *
 * service_id values: mtn_sme | mtn_gifting | mtn_datashare | mtn_awoof |
 *                    glo_sme | glo_data | airtel_sme | airtel_gifting |
 *                    etisalat_data
 */
export async function GET(request: NextRequest) {
  // Verify API key
  const auth = await verifyConnectKey(request)
  if (!auth.success) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status || 401 }
    )
  }

  const { searchParams } = request.nextUrl
  const service = searchParams.get('service')

  if (!service) {
    return NextResponse.json(
      { success: false, error: 'Missing required query param: service' },
      { status: 400 }
    )
  }

  const VALID_SERVICES = [
    'mtn_sme', 'mtn_gifting', 'mtn_datashare', 'mtn_awoof',
    'glo_sme', 'glo_data',
    'airtel_sme', 'airtel_gifting',
    'etisalat_data',
  ]

  if (!VALID_SERVICES.includes(service)) {
    return NextResponse.json(
      { success: false, error: `Invalid service. Must be one of: ${VALID_SERVICES.join(', ')}` },
      { status: 400 }
    )
  }

  try {
    // Map service_id to the network prefix used in api_pricing_rules
    const networkMap: Record<string, string> = {
      mtn_sme: 'mtn', mtn_gifting: 'mtn', mtn_datashare: 'mtn', mtn_awoof: 'mtn',
      glo_sme: 'glo', glo_data: 'glo',
      airtel_sme: 'airtel', airtel_gifting: 'airtel',
      etisalat_data: 'etisalat',
    }
    const networkPrefix = networkMap[service]

    // Fetch live plans from Gsubz and API pricing rules in parallel
    const [gsubzPlans, pricingResult] = await Promise.all([
      getDataPlans(service).then((r) => r.plans || []),
      createAdminClient()
        .from('api_pricing_rules')
        .select('plan_name, base_price, markup_type, markup_value')
        .eq('service_id', networkPrefix)
        .eq('is_active', true),
    ])

    const pricingRules = pricingResult.data || []

    // Build response: for each Gsubz plan, attach API price if rule exists
    const plans = gsubzPlans.map((plan) => {
      const rule = pricingRules.find(
        (r) => r.plan_name.toLowerCase() === plan.displayName.toLowerCase()
      )

      let apiPrice: number | null = null
      if (rule) {
        apiPrice = rule.markup_type === 'fixed'
          ? rule.base_price + rule.markup_value
          : rule.base_price * (1 + rule.markup_value / 100)
      }

      return {
        id: plan.value,
        name: plan.displayName,
        provider_price: parseFloat(plan.price),
        api_price: apiPrice,
        available: apiPrice !== null,
      }
    })

    return NextResponse.json({
      success: true,
      service,
      plans: plans.filter((p) => p.available),
    })
  } catch (err) {
    console.error('[v1] /data/plans error:', err)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch plans' },
      { status: 500 }
    )
  }
}
