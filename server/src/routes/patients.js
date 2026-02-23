import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { requireHospital } from "../middleware/requireHospital.js";

const router = Router();
const withAuth = [requireAuth, requireHospital];

/** GET /api/patients — list patients for the current user's hospital */
router.get("/", ...withAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("patients")
      .select("id, name, phone, email, last_visit, created_at")
      .eq("hospital_id", req.hospitalId)
      .order("name");

    if (error) return res.status(400).json({ error: error.message });
    return res.json(data || []);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/patients — add a patient */
router.post("/", ...withAuth, async (req, res) => {
  try {
    const { name, phone, email } = req.body || {};
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "name is required" });
    }
    if (!phone || typeof phone !== "string" || !phone.trim()) {
      return res.status(400).json({ error: "phone is required" });
    }

    const { data, error } = await supabase
      .from("patients")
      .insert({
        hospital_id: req.hospitalId,
        name: name.trim(),
        phone: phone.trim(),
        email: email?.trim() || null,
      })
      .select("id, name, phone, email, last_visit, created_at")
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
