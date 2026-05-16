import { NextRequest, NextResponse } from 'next/server'
import { v1AuthOrRespond } from '@/lib/middleware/v1-auth-helper'
import { purchaseData, fetchDataPlans } from '@/lib/actions/data'

export async function POST(request: NextRequest) {
  console.log('[V1-DATA-PURCHASE] POST')

  try {
    const auth = await v1AuthOrRespond(request)
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      )
    }

    const body = await request.json().catch(() => ({} as any))
    const { serviceID, plan, phone, requestID } = body || {}

    if (!serviceID || !plan || !phone) {
      return NextResponse.json(
        { success: false, error: 'serviceID, plan, and phone are required' },
        { status: 400 },
      )
    }

    // Look up the marked-up price for this plan so the action deducts the
    // correct amount. We deliberately recompute it here rather than trusting
    // a client-provided amount.
    const plansResult = await fetchDataPlans(String(serviceID))
    if (!plansResult.success) {
      return NextResponse.json(
        { success: false, error: 'Could not load plans for this service' },
        { status: 502 },
      )
    }

    const matched = (plansResult.plans || []).find(
      (p: any) =>
        String(p.id ?? p.plan_id ?? p.code ?? p.displayName) === String(plan) ||
        String(p.displayName) === String(plan),
    )

    if (!matched) {
      return NextResponse.json(
        { success: false, error: 'Invalid plan for this service' },
        { status: 400 },
      )
    }

    const formData = new FormData()
    formData.set('serviceID', String(serviceID))
    formData.set('plan', String(plan))
    formData.set('phone', String(phone))
    formData.set('amount', String(matched.price))
    formData.set('planDisplayName', String(matched.displayName ?? ''))
    if (requestID) formData.set('requestID', String(requestID))

    const result = await purchaseData(formData, auth.userId)

    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (error) {
    console.error('[V1-DATA-PURCHASE] Error')
    return NextResponse.json(
      { success: false, error: 'Failed to process purchase' },
      { status: 500 },
    )
  }
}
