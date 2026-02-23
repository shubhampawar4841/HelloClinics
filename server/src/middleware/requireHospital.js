import { supabase } from "../lib/supabase.js";

/**
 * Requires requireAuth to have run. Loads profile and sets req.hospitalId.
 */
export async function requireHospital(req, res, next) {
  try {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("hospital_id")
      .eq("id", req.user.id)
      .single();

    if (error || !profile?.hospital_id) {
      return res.status(403).json({ error: "Profile or hospital not found" });
    }

    req.hospitalId = profile.hospital_id;
    next();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
