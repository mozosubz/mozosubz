import { NextRequest, NextResponse } from 'next/server'
import { v1AuthOrRespond } from '@/lib/middleware/v1-auth-helper'
import { purchaseAirtime } from '@/lib/actions/airtime'

const NETWORK_FROM_SERVICE_ID: Record<string, string> = {
  mtn: 'MTN',
  airtel: 'Airtel',
  glo: 'Glo',
  etisalat: '9mobile',
  '9mobile': '9mobile',
}

export async function POST(request: NextRequest) {
  console.log('[V1-AIRTIME-PURCHASE] POST')

  try {
    const auth = await v1AuthOrRespond(request)
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      )
    }

    const body = await request.json().catch(() => ({} as any))
    const { serviceID, amount, phone, requestID } = body || {}

    if (!serviceID || !amount || !phone) {
      return NextResponse.json(
        { success: false, error: 'serviceID, amount, and phone are required' },
        { status: 400 },
      )
    }

    const numAmount = parseFloat(String(amount))
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      return NextResponse.json(
        { success: false, error: 'amount must be a positive number' },
        { status: 400 },
      )
    }

    const network = NETWORK_FROM_SERVICE_ID[String(serviceID).toLowerCase()]
    if (!network) {
      return NextResponse.json(
        { success: false, error: 'Invalid serviceID' },
        { status: 400 },
      )
    }

    const formData = new FormData()
    formData.set('network', network)
    formData.set('phone', String(phone))
    formData.set('amount', String(numAmount))
    if (requestID) formData.set('requestID', String(requestID))

    const result = await purchaseAirtime(formData, auth.userId)

    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (error) {
    console.error('[V1-AIRTIME-PURCHASE] Error')
    return NextResponse.json(
      { success: false, error: 'Failed to process purchase' },
      { status: 500 },
    )
  }
}
