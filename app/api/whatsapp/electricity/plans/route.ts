import { NextResponse } from 'next/server'

/**
 * POST /api/whatsapp/electricity/plans
 *
 * Get electricity information. Note: electricity has only ONE plan type
 * (amount-based purchase). This endpoint returns available DISCOs and info.
 * 
 * Body: { disco?: "IKEDC" | "EEDC" | "KEDCO" | etc }
 * (Optional - if not provided, returns info for all DISCOs)
 * 
 * Response:
 * {
 *   success: true,
 *   discos: [
 *     { code: "IKEDC", name: "Ikeja Electric", minAmount: 500, maxAmount: 50000 },
 *     { code: "EEDC", name: "Enugu Electric", minAmount: 500, maxAmount: 50000 },
 *     ...
 *   ]
 * }
 */
export async function POST(request: Request) {
  try {
    // Electricity DISCOs
    const discos = [
      { code: 'IKEDC', name: 'Ikeja Electric', minAmount: 500, maxAmount: 50000 },
      { code: 'EEDC', name: 'Enugu Electric', minAmount: 500, maxAmount: 50000 },
      { code: 'BEDC', name: 'Benin Electric', minAmount: 500, maxAmount: 50000 },
      { code: 'AEDC', name: 'Abuja Electric', minAmount: 500, maxAmount: 50000 },
      { code: 'KEDCO', name: 'Kano Electricity', minAmount: 500, maxAmount: 50000 },
      { code: 'PHED', name: 'Port Harcourt Electric', minAmount: 500, maxAmount: 50000 },
      { code: 'YEDC', name: 'Yola Electric', minAmount: 500, maxAmount: 50000 },
    ]

    return NextResponse.json({
      success: true,
      discos,
      info: 'Electricity has one plan type: amount-based purchase. Any amount from min to max per DISCO.',
    })
  } catch (error) {
    console.error('[v0] whatsapp electricity plans error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
