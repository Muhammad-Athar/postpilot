import { createClient } from "@supabase/supabase-js";

/** Service-role client. Server only. Bypasses RLS, so every query must scope by workspace/brand explicitly. */
export const createAdminSupabase = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
