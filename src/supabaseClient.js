import { createClient } from '@supabase/supabase-js'

// TODO: Replace with the actual URL and Key when user provides them
const supabaseUrl = 'https://jfakdzjxphypjtfwwoqp.supabase.co'
const supabaseKey = 'sb_publishable_CEOW9PCaWqX4DCLE0PoJkg_Y-9pDxbe'

export const supabase = createClient(supabaseUrl, supabaseKey)
