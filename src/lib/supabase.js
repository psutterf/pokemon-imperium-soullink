import { createClient } from '@supabase/supabase-js';

// Supabase is optional. With no credentials the app runs fully in local mode
// (single machine, cross-tab sync). Add credentials in .env.local to enable
// live 2-player sync across devices. See README for the SQL schema.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && anonKey ? createClient(url, anonKey) : null;
export const CLOUD_ENABLED = Boolean(supabase);
