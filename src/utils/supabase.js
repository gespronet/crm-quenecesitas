import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vkhbkdibihwmwyshrofx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZraGJrZGliaWh3bXd5c2hyb2Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NzgyMDQsImV4cCI6MjA4NzI1NDIwNH0.UsFIv4kM3jbzTsR_xMWwWr5bj7F7ZiWdP6xpPOATRNw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
