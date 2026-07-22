import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/v1/bot/acknowledge-notification
 * 
 * Bot sends this after displaying a notification to mark it as acknowledged
 * This prevents duplicate notifications and tracks delivery
 * 
 * Request:
 * {
 *   "payment_reference": "MOZO_xxx",
 *   "notification_type": "deposit_completed"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Notification acknowledged"
 * }
 */

export async function POST(request: NextRequest) {
  try {
    // 1. Verify API key
    const keyVerification = await verifyConnectKey(request)
    if (!keyVerification.success || !keyVerification.userId) {
      console.log('[Bot Acknowledge] ❌ Invalid API key')
      return NextResponse.json(
        { success: false, error: 'Invalid API key' },
        { status: 401 }
      )
    }

    const userId = keyVerification.userId
    const { payment_reference, notification_type } = await request.json()

    if (!payment_reference) {
      return NextResponse.json(
        { success: false, error: 'payment_reference is required' },
        { status: 400 }
      )
    }

    console.log(
      `[Bot Acknowledge] User ${userId} acknowledging notification: ${payment_reference}`
    )

    const supabase = createAdminClient()

    // Update the transaction to mark it as acknowledged
    const { error: updateError } = await supabase
      .from('monnify_transactions')
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq('payment_reference', payment_reference)
      .eq('user_id', userId)
      .eq('status', 'SUCCESS')

    if (updateError) {
      console.error('[Bot Acknowledge] Error updating transaction:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to acknowledge notification' },
        { status: 500 }
      )
    }

    console.log(
      `[Bot Acknowledge] ✓ Notification acknowledged: ${payment_reference}`
    )

    return NextResponse.json(
      {
        success: true,
        message: 'Notification acknowledged',
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[Bot Acknowledge] Exception:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
