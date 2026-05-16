import { NextRequest, NextResponse } from 'next/server'
import { v1AuthOrRespond } from '@/lib/middleware/v1-auth-helper'
import { payElectricity } from '@/lib/actions/electricity'

const DISCO_FROM_SERVICE_ID: Record<string, string> = {
  'ikeja-electric': 'Ikeja Electric',
  'eko-electric': 'Eko Electric',
  'abuja-electric': 'Abuja Electric',
  'kano-electric': 'Kano Electric',
  'portharcourt-electric': 'Port Harcourt Electric',
  'jos-electric': 'Jos Electric',
  'ibadan-electric': 'Ibadan Electric',
  'kaduna-electric': 'Kaduna Electric',
  'enugu-electric': 'Enugu Electric',
  'benin-electric': 'Benin Electric',
  'aba-electric': 'Aba Electric',
  'yola-electric': 'Yola Electric',
}

export async function POST(request: NextRequest) {
  console.log('[V1-ELECTRICITY-PURCHASE] POST')

  try {
    const auth = await v1AuthOrRespond(request)
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      )
    }

    const body = await request.json().catch(() => ({} as any))
    const { serviceID, phone, customerID, amount, variation_code, requestID } = body || {}

    if (!serviceID || !phone || !customerID || !amount || !variation_code) {
      return NextResponse.json(
        {
          success: false,
          error: 'serviceID, phone, customerID, amount, and variation_code are required',
        },
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

    const disco = DISCO_FROM_SERVICE_ID[String(serviceID).toLowerCase()]
    if (!disco) {
      return NextResponse.json(
        { success: false, error: 'Invalid serviceID' },
        { status: 400 },
      )
    }

    const meterType = String(variation_code).toLowerCase()
    if (meterType !== 'prepaid' && meterType !== 'postpaid') {
      return NextResponse.json(
        { success: false, error: 'variation_code must be "prepaid" or "postpaid"' },
        { status: 400 },
      )
    }

    const formData = new FormData()
    formData.set('disco', disco)
    formData.set('meterType', meterType)
    formData.set('meterNumber', String(customerID))
    formData.set('amount', String(numAmount))
    formData.set('phone', String(phone))
    if (requestID) formData.set('requestID', String(requestID))

    const result = await payElectricity(formData, auth.userId)

    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (error) {
    console.error('[V1-ELECTRICITY-PURCHASE] Error')
    return NextResponse.json(
      { success: false, error: 'Failed to process purchase' },
      { status: 500 },
    )
  }
}
