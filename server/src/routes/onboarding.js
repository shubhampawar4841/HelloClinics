import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

/** GET /api/me — current user's profile + hospital (or 404 if not onboarded) */
router.get("/me", requireAuth, async (req, res) => {
  try {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, hospital_id, role, full_name, doctor_id")
      .eq("id", req.user.id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: "Profile not found", code: "NOT_ONBOARDED" });
    }

    const { data: hospital, error: hospitalError } = await supabase
      .from("hospitals")
      .select("id, name, email, phone, address, twilio_number")
      .eq("id", profile.hospital_id)
      .single();

    if (hospitalError || !hospital) {
      return res.status(500).json({ error: "Hospital not found" });
    }

    return res.json({ profile, hospital });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/onboarding — create hospital + profile (idempotent if already onboarded) */
router.post("/onboarding", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { hospitalName, email, phone, address, fullName } = req.body || {};

    if (!hospitalName || typeof hospitalName !== "string" || !hospitalName.trim()) {
      return res.status(400).json({ error: "hospitalName is required" });
    }

    const { data: existing } = await supabase.from("profiles").select("id, hospital_id").eq("id", userId).single();
    if (existing) {
      const { data: hospital } = await supabase.from("hospitals").select("id, name, email, phone, address, twilio_number").eq("id", existing.hospital_id).single();
      return res.status(200).json({
        profile: await getProfile(userId),
        hospital,
        alreadyOnboarded: true,
      });
    }

    const { data: hospital, error: hospitalError } = await supabase
      .from("hospitals")
      .insert({
        name: hospitalName.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        address: address?.trim() || null,
      })
      .select("id, name, email, phone, address, twilio_number")
      .single();

    if (hospitalError) {
      return res.status(400).json({ error: hospitalError.message });
    }

    const { error: profileError } = await supabase.from("profiles").insert({
      id: userId,
      hospital_id: hospital.id,
      role: "admin",
      full_name: fullName?.trim() || null,
    });

    if (profileError) {
      return res.status(400).json({ error: profileError.message });
    }

    const profile = await getProfile(userId);
    return res.status(201).json({ profile, hospital });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

async function getProfile(userId) {
  const { data } = await supabase.from("profiles").select("id, hospital_id, role, full_name, doctor_id").eq("id", userId).single();
  return data;
}

export default router;
