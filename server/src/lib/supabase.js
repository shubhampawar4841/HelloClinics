import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY; auth and DB will fail.");
}

export const supabase = createClient(supabaseUrl || "", supabaseServiceRoleKey || "", {
  auth: { persistSession: false },
});
