import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Extract and verify JWT token from Authorization header
 * Returns the authenticated user or null
 */
export async function checkAuth(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.substring(7)
    const supabase = createAdminClient()

    // Verify token with Supabase
    const {
      data: { user },
    } = await supabase.auth.getUser(token)

    return user
  } catch (error) {
    return null
  }
}
