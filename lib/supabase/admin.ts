import { createClient } from '@supabase/supabase-js'

// Admin client with service role key - bypasses RLS
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  console.log('[ADMIN-CLIENT] Supabase URL:', supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'NOT SET')
  console.log('[ADMIN-CLIENT] Service Role Key:', serviceRoleKey ? `${serviceRoleKey.substring(0, 30)}...` : 'NOT SET')

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase admin credentials')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
