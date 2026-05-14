import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'

/**
 * POST /api/mozosubz/v1/services/electricity/plans
 * 
 * Get available electricity providers (DISCOs)
 */
export async function POST(request: NextRequest) {
  try {
    const keyVerification = await verifyConnectKey(request)
    if (!keyVerification.success) {
      return NextResponse.json(
        { success: false, error: keyVerification.error },
        { status: keyVerification.status || 401 },
      )
    }

    // Return list of available electricity providers
    const providers = [
      { id: 'eko', name: 'Eko Electric', code: 'eko' },
      { id: 'ibadanelectric', name: 'Ibadan Electric', code: 'ibadanelectric' },
      { id: 'kano', name: 'Kano Electric', code: 'kano' },
      { id: 'jos', name: 'Jos Electric', code: 'jos' },
      { id: 'kaduna', name: 'Kaduna Electric', code: 'kaduna' },
    ]

    return NextResponse.json({
      success: true,
      providers,
    })
  } catch (error) {
    console.error('[v0] Mozosubz electricity plans error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
