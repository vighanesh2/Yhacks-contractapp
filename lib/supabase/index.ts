import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

/**
 * Service-role client for API routes only. Null when env is not configured.
 */
export const supabaseAdmin: SupabaseClient | null =
  url && serviceKey ? createClient(url, serviceKey) : null;
