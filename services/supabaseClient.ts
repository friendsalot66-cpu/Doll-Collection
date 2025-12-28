import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mrwktbhjabdwadjmdakc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yd2t0YmhqYWJkd2Fkam1kYWtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5MDQ3NDYsImV4cCI6MjA4MjQ4MDc0Nn0.qugbCpkoWljZJEveiy9yaGkQ27oxd_mV_xxe15qOUw8';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
