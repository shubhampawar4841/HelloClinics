import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { requireHospital } from "../middleware/requireHospital.js";

const router = Router();
const withAuth = [requireAuth, requireHospital];

/** DELETE /api/doctor-availability/:id — delete an availability slot */
router.delete("/:id", ...withAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { data: existing, error: fetchError } = await supabase
      .from("doctor_availability")
      .select("id")
      .eq("id", id)
      .eq("hospital_id", req.hospitalId)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({ error: "Availability slot not found" });
    }

    const { error: deleteError } = await supabase.from("doctor_availability").delete().eq("id", id);
    if (deleteError) return res.status(400).json({ error: deleteError.message });
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
