import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/admin/gsubz-balance
 * 
 * Fetch current gSubz wallet balance (internal endpoint)
 * Uses the server-side GSUBZ_API_KEY (never exposed to client)
 */
export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile?.is_admin) {
      return NextResponse.json(
        { success: false, message: 'Admin access required' },
        { status: 403 }
      )
    }

    const apiKey = process.env.GSUBZ_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { success: false, message: 'API key not configured' },
        { status: 500 }
      )
    }

    // Call gSubz API with private key
    const formData = new FormData()
    formData.append('api', apiKey)

    const response = await fetch('https://api.gsubz.com/api/balance/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    })

    if (!response.ok) {
      console.error('[v0] gSubz API error:', response.status, await response.text())
      return NextResponse.json(
        { success: false, message: 'Failed to fetch balance' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json({
      success: true,
      balance: parseFloat(data.balance) || 0,
      formatted: `₦${parseFloat(data.balance || 0).toLocaleString('en-NG', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
    })
  } catch (error) {
    console.error('[v0] gsubz balance error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
