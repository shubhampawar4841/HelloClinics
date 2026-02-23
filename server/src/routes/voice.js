import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { voiceAuth } from "../middleware/voiceAuth.js";

const router = Router();
router.use(voiceAuth);

// --- Slot generation helpers (mirror client logic) ---
function timeToMinutes(t) {
  const parts = String(t).trim().split(":").map(Number);
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
}

function minutesToTime(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function getBookableTimesForDay(availability, dayOfWeek, excludeTimes = []) {
  const set = new Set();
  const slotsForDay = (availability || []).filter(
    (s) => s.day_of_week === dayOfWeek && s.is_active
  );
  for (const slot of slotsForDay) {
    const startMin = timeToMinutes(slot.start_time);
    const endMin = timeToMinutes(slot.end_time);
    const step = slot.slot_duration_minutes || 15;
    for (let m = startMin; m < endMin; m += step) {
      const time = minutesToTime(m);
      if (!excludeTimes.includes(time)) set.add(time);
    }
  }
  return Array.from(set).sort();
}

function parseDate(str) {
  if (!str || typeof str !== "string") return null;
  const trimmed = str.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const d = new Date(trimmed + "T12:00:00");
  return isNaN(d.getTime()) ? null : trimmed;
}

/** GET /api/voice/doctors — list doctors for the hospital (Twilio to number) */
router.get("/doctors", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("doctors")
      .select("id, name, specialization")                      
      .eq("hospital_id", req.hospitalId)
      .eq("is_active", true)
      .order("name");

    if (error) return res.status(400).json({ error: error.message });
    return res.json(data || []);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/** GET /api/voice/slots — available slots for next 7 days. Query: doctor_id (optional), from_date (optional, YYYY-MM-DD) */
router.get("/slots", async (req, res) => {
  try {
    const { doctor_id: doctorIdParam, from_date: fromDateParam } = req.query;
    const fromDateStr = fromDateParam && parseDate(String(fromDateParam));
    const startDate = fromDateStr
      ? new Date(fromDateStr + "T12:00:00")
      : new Date();
    startDate.setHours(0, 0, 0, 0);

    let doctorsQuery = supabase
      .from("doctors")
      .select("id, name")
      .eq("hospital_id", req.hospitalId)
      .eq("is_active", true);
    if (doctorIdParam && String(doctorIdParam).trim()) {
      doctorsQuery = doctorsQuery.eq("id", String(doctorIdParam).trim());
    }
    const { data: doctors, error: doctorsError } = await doctorsQuery;
    if (doctorsError) return res.status(400).json({ error: doctorsError.message });
    if (!doctors?.length) return res.json([]);

    const doctorIds = doctors.map((d) => d.id);
    const doctorMap = Object.fromEntries(doctors.map((d) => [d.id, d]));

    const { data: allAvailability, error: availError } = await supabase
      .from("doctor_availability")
      .select("doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, is_active")
      .in("doctor_id", doctorIds)
      .eq("hospital_id", req.hospitalId);

    if (availError) return res.status(400).json({ error: availError.message });
    const availabilityByDoctor = {};
    for (const row of allAvailability || []) {
      if (!availabilityByDoctor[row.doctor_id])
        availabilityByDoctor[row.doctor_id] = [];
      availabilityByDoctor[row.doctor_id].push(row);
    }

    const dateStrings = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      dateStrings.push(d.toISOString().slice(0, 10));
    }

    const { data: appointmentsInRange } = await supabase
      .from("appointments")
      .select("doctor_id, date, time")
      .eq("hospital_id", req.hospitalId)
      .in("doctor_id", doctorIds)
      .in("date", dateStrings);

    const bookedByDoctorDate = {};
    for (const a of appointmentsInRange || []) {
      const key = `${a.doctor_id}:${a.date}`;
      if (!bookedByDoctorDate[key]) bookedByDoctorDate[key] = [];
      const t = (a.time || "").length > 5 ? (a.time || "").slice(0, 5) : (a.time || "");
      if (t) bookedByDoctorDate[key].push(t);
    }

    const slots = [];
    for (const doctor of doctors) {
      const availability = availabilityByDoctor[doctor.id] || [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const dateStr = dateStrings[i];
        const dayOfWeek = d.getDay();
        const bookedTimes = bookedByDoctorDate[`${doctor.id}:${dateStr}`] || [];
        const times = getBookableTimesForDay(availability, dayOfWeek, bookedTimes);
        for (const time of times) {
          slots.push({
            date: dateStr,
            time,
            doctor_id: doctor.id,
            doctor_name: doctor.name,
          });
        }
      }
    }

    slots.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    return res.json(slots);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/** Normalize phone for lookup: trim and remove spaces */
function normalizePhone(phone) {
  return String(phone ?? "").trim().replace(/\s/g, "");
}

/** Strip Bolna/template literals like {+91...} or {{from_number}} so we can use the inner value when substitution fails */
function stripTemplateBraces(value) {
  if (value == null || typeof value !== "string") return value;
  let s = value.trim();
  const m = s.match(/^\{\{?(.+?)\}\}?$/);
  return m ? m[1].trim() : s;
}

/** Return phone variants for DB lookup (e.g. +919... and 919...) so we match regardless of storage */
function phoneLookupVariants(phone) {
  const p = normalizePhone(phone);
  if (!p) return [];
  const withoutPlus = p.startsWith("+") ? p.slice(1) : p;
  const withPlus = p.startsWith("+") ? p : `+${p}`;
  return [...new Set([p, withoutPlus, withPlus])];
}

/** Caller number: generic header (Plivo/Twilio/Bolna compatible) */
function getCallerNumber(req) {
  return (
    req.headers["x-user-number"] ||
    req.headers["x-twilio-from-number"] ||
    req.headers["x-plivo-from-number"]
  );
}

/** GET /api/voice/appointments — list upcoming appointments for a patient. Query: patient_phone (or header x-user-number). Supports Bolna sending literal {+91...}; if that value is the hospital number (to_number), use caller from headers instead. */
router.get("/appointments", async (req, res) => {
  try {
    const hospitalNumber = normalizePhone(req.voiceContext?.to_number || "");
    let rawPhone = stripTemplateBraces(req.query.patient_phone || getCallerNumber(req) || "");
    let patientPhone = normalizePhone(rawPhone);
    // If Bolna sent the hospital number (number they called) instead of caller number, use caller from headers
    if (patientPhone && hospitalNumber && phoneLookupVariants(patientPhone).includes(hospitalNumber)) {
      const callerFromHeader = normalizePhone(stripTemplateBraces(getCallerNumber(req) || ""));
      if (callerFromHeader) patientPhone = callerFromHeader;
    }
    if (!patientPhone) {
      return res.status(400).json({ error: "patient_phone or x-user-number (or x-twilio-from-number / x-plivo-from-number) required" });
    }

    const variants = phoneLookupVariants(patientPhone);
    let patientIds = [];
    for (const variant of variants) {
      const { data: patients, error: patientErr } = await supabase
        .from("patients")
        .select("id")
        .eq("hospital_id", req.hospitalId)
        .eq("phone", variant);
      if (patientErr) return res.status(500).json({ error: "Failed to find patient" });
      if (patients?.length) {
        patientIds = patients.map((p) => p.id);
        break;
      }
    }
    if (patientIds.length === 0) return res.json([]);

    const today = new Date().toISOString().slice(0, 10);
    const { data: appointments, error } = await supabase
      .from("appointments")
      .select("id, date, time, status, doctor_id")
      .eq("hospital_id", req.hospitalId)
      .in("patient_id", patientIds)
      .gte("date", today)
      .neq("status", "cancelled")
      .order("date", { ascending: true })
      .order("time", { ascending: true });
    if (error) return res.status(400).json({ error: error.message });
    if (!appointments?.length) return res.json([]);

    const doctorIds = [...new Set(appointments.map((a) => a.doctor_id))];
    const { data: doctors } = await supabase.from("doctors").select("id, name").in("id", doctorIds);
    const doctorMap = Object.fromEntries((doctors || []).map((d) => [d.id, d]));

    const rows = appointments.map((a) => ({
      id: a.id,
      date: a.date,
      time: (a.time || "").length > 5 ? (a.time || "").slice(0, 5) : a.time,
      status: a.status,
      doctor_name: doctorMap[a.doctor_id]?.name ?? "",
    }));
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/voice/appointments/find — find appointment by patient name + doctor name + date (voice-friendly, no phone needed). */
router.post("/appointments/find", async (req, res) => {
  try {
    const { patient_name, doctor_name, date } = req.body || {};

    const pName = typeof patient_name === "string" && patient_name.trim();
    const dName = typeof doctor_name === "string" && doctor_name.trim();
    const dateStr = parseDate(date);

    if (!pName || !dName || !dateStr) {
      return res.status(400).json({
        error: "patient_name, doctor_name, and date (YYYY-MM-DD) are required",
      });
    }

    const { data: doctor, error: doctorErr } = await supabase
      .from("doctors")
      .select("id, name")
      .eq("hospital_id", req.hospitalId)
      .ilike("name", `%${dName}%`)
      .limit(1)
      .maybeSingle();
    if (doctorErr) return res.status(500).json({ error: doctorErr.message });
    if (!doctor) {
      return res.json({ found: false, message: "Doctor not found" });
    }

    const { data: patient, error: patientErr } = await supabase
      .from("patients")
      .select("id, name")
      .eq("hospital_id", req.hospitalId)
      .ilike("name", `%${pName}%`)
      .limit(1)
      .maybeSingle();
    if (patientErr) return res.status(500).json({ error: patientErr.message });
    if (!patient) {
      return res.json({ found: false, message: "Patient not found" });
    }

    const { data: appointment, error: appErr } = await supabase
      .from("appointments")
      .select("id, date, time, status")
      .eq("hospital_id", req.hospitalId)
      .eq("doctor_id", doctor.id)
      .eq("patient_id", patient.id)
      .eq("date", dateStr)
      .maybeSingle();
    if (appErr) return res.status(500).json({ error: appErr.message });
    if (!appointment) {
      return res.json({ found: false, message: "No appointment found" });
    }

    return res.json({
      found: true,
      id: appointment.id,
      date: appointment.date,
      time: (appointment.time || "").length > 5 ? (appointment.time || "").slice(0, 5) : appointment.time,
      status: appointment.status,
      doctor_name: doctor.name,
      patient_name: patient.name,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/voice/appointments — book appointment. Body: doctor_id, date, time, patient_phone, patient_name (optional). Find or create patient by phone. */
router.post("/appointments", async (req, res) => {
  try {
    const { doctor_id, date, time, patient_phone, patient_name } = req.body || {};

    if (!doctor_id || typeof doctor_id !== "string" || !doctor_id.trim()) {
      return res.status(400).json({ error: "doctor_id is required" });
    }
    const dateStr = parseDate(date);
    if (!dateStr) return res.status(400).json({ error: "date is required (YYYY-MM-DD)" });
    if (!time || typeof time !== "string" || !String(time).trim()) {
      return res.status(400).json({ error: "time is required (HH:mm)" });
    }
    const phone = normalizePhone(stripTemplateBraces(patient_phone));
    if (!phone) return res.status(400).json({ error: "patient_phone is required" });

    const { data: doctor, error: doctorErr } = await supabase
      .from("doctors")
      .select("id, name")
      .eq("id", doctor_id.trim())
      .eq("hospital_id", req.hospitalId)
      .single();
    if (doctorErr || !doctor) return res.status(400).json({ error: "Doctor not found" });

    let patientId;
    const { data: existingPatient } = await supabase
      .from("patients")
      .select("id, name")
      .eq("hospital_id", req.hospitalId)
      .eq("phone", phone)
      .maybeSingle();

    if (existingPatient) {
      patientId = existingPatient.id;
    } else {
      const name = (patient_name && String(patient_name).trim()) || "Voice Caller";
      const { data: newPatient, error: createErr } = await supabase
        .from("patients")
        .insert({
          hospital_id: req.hospitalId,
          name,
          phone,
        })
        .select("id")
        .single();
      if (createErr) return res.status(400).json({ error: "Failed to create patient" });
      patientId = newPatient.id;
    }

    const timeStr = String(time).trim();
    const timeNormalized = timeStr.length <= 5 ? `${timeStr}:00` : timeStr;

    const insertPayload = {
      hospital_id: req.hospitalId,
      patient_id: patientId,
      doctor_id: doctor.id,
      date: dateStr,
      time: timeNormalized,
      status: "pending",
      source: "voice",
    };

    const { data: created, error: insertErr } = await supabase
      .from("appointments")
      .insert(insertPayload)
      .select("id, date, time, status, patient_id, doctor_id")
      .single();

    if (insertErr) return res.status(400).json({ error: insertErr.message || "Booking failed" });

    const { data: patient } = await supabase
      .from("patients")
      .select("name")
      .eq("id", patientId)
      .single();

    const confirmationMessage = `You're booked with ${doctor.name} on ${dateStr} at ${timeNormalized.slice(0, 5)}.`;

    return res.status(201).json({
      id: created.id,
      date: created.date,
      time: created.time,
      status: created.status,
      doctor_id: created.doctor_id,
      doctor_name: doctor.name,
      patient_name: patient?.name ?? "Voice Caller",
      confirmation_message: confirmationMessage,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/voice/appointments/cancel — cancel by body only. Use this URL in Bolna so no path substitution is needed. */
router.post("/appointments/cancel", async (req, res) => {
  try {
    const appointmentId = stripTemplateBraces(req.body?.appointment_id ?? req.body?.id ?? "").trim();
    if (!appointmentId) return res.status(400).json({ error: "appointment_id required in body" });
    await doCancelAppointment(req, res, appointmentId);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/voice/appointments/:id/cancel — cancel by URL id or body appointment_id (fallback when Bolna sends literal {appointment_id}). */
router.post("/appointments/:id/cancel", async (req, res) => {
  try {
    let appointmentId = stripTemplateBraces(req.params.id ?? "").trim();
    if (!appointmentId || appointmentId === "appointment_id") {
      appointmentId = stripTemplateBraces(req.body?.appointment_id ?? req.body?.id ?? "").trim();
    }
    if (!appointmentId) return res.status(400).json({ error: "Appointment id required (URL path or body: appointment_id)" });
    await doCancelAppointment(req, res, appointmentId);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

async function doCancelAppointment(req, res, appointmentId) {
  try {

    const hospitalNumber = normalizePhone(req.voiceContext?.to_number || "");
    let patientPhone = normalizePhone(stripTemplateBraces(req.body?.patient_phone || getCallerNumber(req) || ""));
    if (patientPhone && hospitalNumber && phoneLookupVariants(patientPhone).includes(hospitalNumber)) {
      const callerFromHeader = normalizePhone(stripTemplateBraces(getCallerNumber(req) || ""));
      if (callerFromHeader) patientPhone = callerFromHeader;
    }
    if (!patientPhone) {
      return res.status(400).json({ error: "patient_phone or x-user-number (or x-twilio-from-number / x-plivo-from-number) required" });
    }

    const { data: appointment, error: fetchErr } = await supabase
      .from("appointments")
      .select("id, patient_id, date, time, status")
      .eq("id", appointmentId)
      .eq("hospital_id", req.hospitalId)
      .single();
    if (fetchErr || !appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    if (appointment.status === "cancelled") {
      return res.status(400).json({ error: "Appointment is already cancelled" });
    }

    const { data: patient } = await supabase
      .from("patients")
      .select("id, phone")
      .eq("id", appointment.patient_id)
      .single();
    const patientPhoneNorm = normalizePhone(patient?.phone ?? "");
    const callerVariants = phoneLookupVariants(patientPhone);
    if (!patient || !patientPhoneNorm || !callerVariants.includes(patientPhoneNorm)) {
      return res.status(403).json({ error: "Caller phone does not match appointment patient" });
    }

    const { error: updateErr } = await supabase
      .from("appointments")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", appointmentId);
    if (updateErr) return res.status(400).json({ error: updateErr.message });

    return res.json({
      cancelled: true,
      id: appointmentId,
      message: `Your appointment on ${appointment.date} at ${(appointment.time || "").slice(0, 5)} has been cancelled.`,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export default router;
