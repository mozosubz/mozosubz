import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('URL:', url)
console.log('Key first 50 chars:', key?.substring(0, 50))

if (!url || !key) {
  console.error('Missing credentials')
  process.exit(1)
}

const client = createClient(url, key, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

console.log('Client created successfully')

// Test query
client
  .from('connect_keys')
  .select('id, key_preview')
  .limit(1)
  .then(({ data, error }) => {
    if (error) {
      console.error('Query error:', error)
    } else {
      console.log('Query successful! Found', data?.length, 'keys')
      if (data && data.length > 0) {
        console.log('Sample key:', data[0])
      }
    }
  })
