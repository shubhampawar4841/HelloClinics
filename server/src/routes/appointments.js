import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { requireHospital } from "../middleware/requireHospital.js";

const router = Router();
const withAuth = [requireAuth, requireHospital];

/** GET /api/appointments — list appointments (optional ?date=YYYY-MM-DD) with patient + doctor names */
router.get("/", ...withAuth, async (req, res) => {
  try {
    const { date } = req.query;
    let query = supabase
      .from("appointments")
      .select("id, date, time, status, notes, patient_id, doctor_id")
      .eq("hospital_id", req.hospitalId)
      .order("date", { ascending: true })
      .order("time", { ascending: true });

    if (date && typeof date === "string") {
      query = query.eq("date", date);
    }

    const { data: appointments, error } = await query;
    if (error) return res.status(400).json({ error: error.message });
    if (!appointments?.length) return res.json([]);

    const patientIds = [...new Set(appointments.map((a) => a.patient_id))];
    const doctorIds = [...new Set(appointments.map((a) => a.doctor_id))];

    const [patientsRes, doctorsRes] = await Promise.all([
      supabase.from("patients").select("id, name, phone").in("id", patientIds),
      supabase.from("doctors").select("id, name").in("id", doctorIds),
    ]);

    const patientsMap = Object.fromEntries((patientsRes.data || []).map((p) => [p.id, p]));
    const doctorsMap = Object.fromEntries((doctorsRes.data || []).map((d) => [d.id, d]));

    const rows = appointments.map((row) => {
      const p = patientsMap[row.patient_id];
      const d = doctorsMap[row.doctor_id];
      return {
        id: row.id,
        date: row.date,
        time: row.time,
        status: row.status,
        notes: row.notes,
        patient_id: row.patient_id,
        doctor_id: row.doctor_id,
        patientName: p?.name ?? "",
        phone: p?.phone ?? "",
        doctor: d?.name ?? "",
      };
    });

    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/appointments — create appointment */
router.post("/", ...withAuth, async (req, res) => {
  try {
    const { patient_id, doctor_id, date, time, status, notes } = req.body || {};
    if (!patient_id) return res.status(400).json({ error: "patient_id is required" });
    if (!doctor_id) return res.status(400).json({ error: "doctor_id is required" });
    if (!date || typeof date !== "string") return res.status(400).json({ error: "date is required (YYYY-MM-DD)" });
    if (!time || typeof time !== "string") return res.status(400).json({ error: "time is required (HH:mm or HH:mm:ss)" });

    const { data: patient } = await supabase
      .from("patients")
      .select("id")
      .eq("id", patient_id)
      .eq("hospital_id", req.hospitalId)
      .single();
    if (!patient) return res.status(400).json({ error: "Patient not found" });

    const { data: doctor } = await supabase
      .from("doctors")
      .select("id")
      .eq("id", doctor_id)
      .eq("hospital_id", req.hospitalId)
      .single();
    if (!doctor) return res.status(400).json({ error: "Doctor not found" });

    const statusVal = status && ["pending", "confirmed", "cancelled", "completed"].includes(status) ? status : "pending";
    const timeStr = String(time).trim();
    const timeNormalized = timeStr.length <= 5 ? `${timeStr}:00` : timeStr;

    const insertPayload = {
      hospital_id: req.hospitalId,
      patient_id: patient_id,
      doctor_id: doctor_id,
      date,
      time: timeNormalized,
      status: statusVal,
      notes: notes?.trim() || null,
    };
    if (req.body.source != null) insertPayload.source = req.body.source;

    const { data, error } = await supabase
      .from("appointments")
      .insert(insertPayload)
      .select("id, date, time, status, patient_id, doctor_id")
      .single();

    if (error) return res.status(400).json({ error: error.message || "Insert failed" });

    const { data: p } = await supabase.from("patients").select("name, phone").eq("id", patient_id).single();
    const { data: doc } = await supabase.from("doctors").select("name").eq("id", doctor_id).single();

    return res.status(201).json({
      ...data,
      patientName: p?.name ?? "",
      phone: p?.phone ?? "",
      doctor: doc?.name ?? "",
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/** DELETE /api/appointments/:id */
router.delete("/:id", ...withAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { data: existing, error: fetchError } = await supabase
      .from("appointments")
      .select("id")
      .eq("id", id)
      .eq("hospital_id", req.hospitalId)
      .single();

    if (fetchError || !existing) return res.status(404).json({ error: "Appointment not found" });

    const { error: deleteError } = await supabase.from("appointments").delete().eq("id", id);
    if (deleteError) return res.status(400).json({ error: deleteError.message });
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
