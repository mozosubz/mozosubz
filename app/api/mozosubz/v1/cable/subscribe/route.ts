import { NextRequest, NextResponse } from 'next/server'
import { v1AuthOrRespond } from '@/lib/middleware/v1-auth-helper'
import { subscribeCable, fetchCablePlans } from '@/lib/actions/cable'

const PROVIDER_FROM_SERVICE_ID: Record<string, string> = {
  dstv: 'DSTV',
  gotv: 'GOTV',
  startimes: 'STARTIMES',
}

export async function POST(request: NextRequest) {
  console.log('[V1-CABLE-SUBSCRIBE] POST')

  try {
    const auth = await v1AuthOrRespond(request)
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      )
    }

    const body = await request.json().catch(() => ({} as any))
    const { serviceID, plan, phone, customerID, requestID } = body || {}

    if (!serviceID || !plan || !phone || !customerID) {
      return NextResponse.json(
        { success: false, error: 'serviceID, plan, phone, and customerID are required' },
        { status: 400 },
      )
    }

    const provider = PROVIDER_FROM_SERVICE_ID[String(serviceID).toLowerCase()]
    if (!provider) {
      return NextResponse.json(
        { success: false, error: 'Invalid serviceID. Use dstv, gotv, or startimes' },
        { status: 400 },
      )
    }

    // Recompute the marked-up package price server-side.
    const plansResult = await fetchCablePlans(provider)
    if (!plansResult.success) {
      return NextResponse.json(
        { success: false, error: 'Could not load packages for this provider' },
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
        { success: false, error: 'Invalid plan for this provider' },
        { status: 400 },
      )
    }

    const formData = new FormData()
    formData.set('provider', provider)
    formData.set('package', String(plan))
    formData.set('packageDisplayName', String(matched.displayName ?? ''))
    formData.set('smartcard', String(customerID))
    formData.set('phone', String(phone))
    if (requestID) formData.set('requestID', String(requestID))

    const result = await subscribeCable(formData, auth.userId)

    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (error) {
    console.error('[V1-CABLE-SUBSCRIBE] Error')
    return NextResponse.json(
      { success: false, error: 'Failed to process subscription' },
      { status: 500 },
    )
  }
}
