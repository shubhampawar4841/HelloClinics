import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { requireHospital } from "../middleware/requireHospital.js";

const router = Router();
const withAuth = [requireAuth, requireHospital];

/** GET /api/doctors — list doctors for the current user's hospital */
router.get("/", ...withAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("doctors")
      .select("id, name, specialization, email, is_active, created_at")
      .eq("hospital_id", req.hospitalId)
      .order("name");

    if (error) return res.status(400).json({ error: error.message });
    return res.json(data || []);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/doctors — add a doctor */
router.post("/", ...withAuth, async (req, res) => {
  try {
    const { name, specialization, email } = req.body || {};
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "name is required" });
    }
    if (!specialization || typeof specialization !== "string" || !specialization.trim()) {
      return res.status(400).json({ error: "specialization is required" });
    }

    const { data, error } = await supabase
      .from("doctors")
      .insert({
        hospital_id: req.hospitalId,
        name: name.trim(),
        specialization: specialization.trim(),
        email: email?.trim() || null,
        is_active: true,
      })
      .select("id, name, specialization, email, is_active, created_at")
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/** GET /api/doctors/:id/availability — list availability slots for a doctor */
router.get("/:id/availability", ...withAuth, async (req, res) => {
  try {
    const { id: doctorId } = req.params;
    const { data: doctor } = await supabase
      .from("doctors")
      .select("id")
      .eq("id", doctorId)
      .eq("hospital_id", req.hospitalId)
      .single();
    if (!doctor) return res.status(404).json({ error: "Doctor not found" });

    const { data, error } = await supabase
      .from("doctor_availability")
      .select("id, day_of_week, start_time, end_time, slot_duration_minutes, is_active")
      .eq("doctor_id", doctorId)
      .eq("hospital_id", req.hospitalId)
      .order("day_of_week")
      .order("start_time");

    if (error) return res.status(400).json({ error: error.message });
    return res.json(data || []);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/doctors/:id/availability — add an availability slot */
router.post("/:id/availability", ...withAuth, async (req, res) => {
  try {
    const { id: doctorId } = req.params;
    const { day_of_week, start_time, end_time, slot_duration_minutes } = req.body || {};

    const { data: doctor } = await supabase
      .from("doctors")
      .select("id")
      .eq("id", doctorId)
      .eq("hospital_id", req.hospitalId)
      .single();
    if (!doctor) return res.status(404).json({ error: "Doctor not found" });

    if (typeof day_of_week !== "number" || day_of_week < 0 || day_of_week > 6) {
      return res.status(400).json({ error: "day_of_week is required (0–6, 0=Sunday)" });
    }
    if (!start_time || typeof start_time !== "string") return res.status(400).json({ error: "start_time is required (HH:mm or HH:mm:ss)" });
    if (!end_time || typeof end_time !== "string") return res.status(400).json({ error: "end_time is required (HH:mm or HH:mm:ss)" });

    const startNorm = start_time.trim().length <= 5 ? `${start_time.trim()}:00` : start_time.trim();
    const endNorm = end_time.trim().length <= 5 ? `${end_time.trim()}:00` : end_time.trim();
    const slotMins = slot_duration_minutes != null ? Math.max(5, Math.min(120, Number(slot_duration_minutes) || 15)) : 15;

    const { data, error } = await supabase
      .from("doctor_availability")
      .insert({
        hospital_id: req.hospitalId,
        doctor_id: doctorId,
        day_of_week,
        start_time: startNorm,
        end_time: endNorm,
        slot_duration_minutes: slotMins,
        is_active: true,
      })
      .select("id, day_of_week, start_time, end_time, slot_duration_minutes, is_active")
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/** DELETE /api/doctors/:id — delete a doctor (must belong to same hospital) */
router.delete("/:id", ...withAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { data: existing, error: fetchError } = await supabase
      .from("doctors")
      .select("id")
      .eq("id", id)
      .eq("hospital_id", req.hospitalId)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({ error: "Doctor not found" });
    }

    const { error: deleteError } = await supabase.from("doctors").delete().eq("id", id);

    if (deleteError) return res.status(400).json({ error: deleteError.message });
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
