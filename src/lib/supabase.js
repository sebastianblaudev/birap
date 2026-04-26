import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://dvafcqfjtmtqffdmyymc.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2YWZjcWZqdG10cWZmZG15eW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MDYyMDEsImV4cCI6MjA5MjM4MjIwMX0.IaHsHqiVe9VgBMUm5Y-STX9vqphWF79dCS3yYUkDa3w'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
