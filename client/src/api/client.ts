const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export type Profile = {
  id: string;
  hospital_id: string;
  role: string;
  full_name: string | null;
  doctor_id: string | null;
};

export type Hospital = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  twilio_number: string | null;
};

export type MeResponse = {
  profile: Profile;
  hospital: Hospital;
};

export type OnboardingResponse = {
  profile: Profile;
  hospital: Hospital;
  alreadyOnboarded?: boolean;
};

import supabase from "@/lib/supabase";

async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export async function fetchWithAuth(
  path: string,
  options: RequestInit = {},
  /** Pass token from auth context when available to avoid extra getSession() and lock contention */
  accessToken?: string | null
): Promise<Response> {
  const token = accessToken ?? (await getAccessToken());
  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(`${API_URL}${path}`, { ...options, headers });
}

export async function getMe(accessToken?: string | null): Promise<MeResponse | null> {
  const res = await fetchWithAuth("/api/me", {}, accessToken);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function postOnboarding(
  body: {
    hospitalName: string;
    email?: string;
    phone?: string;
    address?: string;
    fullName?: string;
  },
  accessToken?: string | null
): Promise<OnboardingResponse> {
  const res = await fetchWithAuth("/api/onboarding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, accessToken);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Onboarding failed");
  }
  return res.json();
}

// --- Doctors ---
export type Doctor = {
  id: string;
  name: string;
  specialization: string;
  email?: string | null;
  is_active?: boolean;
  created_at?: string;
};

export async function getDoctors(accessToken?: string | null): Promise<Doctor[]> {
  const res = await fetchWithAuth("/api/doctors", {}, accessToken);
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function createDoctor(
  body: { name: string; specialization: string; email?: string },
  accessToken?: string | null
): Promise<Doctor> {
  const res = await fetchWithAuth("/api/doctors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, accessToken);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Failed to add doctor");
  }
  return res.json();
}

export async function deleteDoctor(id: string, accessToken?: string | null): Promise<void> {
  const res = await fetchWithAuth(`/api/doctors/${id}`, { method: "DELETE" }, accessToken);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Failed to delete doctor");
  }
}

// --- Doctor availability ---
export type DoctorAvailability = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  is_active: boolean;
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function getDayName(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek] ?? String(dayOfWeek);
}

export async function getDoctorAvailability(
  doctorId: string,
  accessToken?: string | null
): Promise<DoctorAvailability[]> {
  const res = await fetchWithAuth(`/api/doctors/${doctorId}/availability`, {}, accessToken);
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function createDoctorAvailability(
  doctorId: string,
  body: { day_of_week: number; start_time: string; end_time: string; slot_duration_minutes?: number },
  accessToken?: string | null
): Promise<DoctorAvailability> {
  const res = await fetchWithAuth(`/api/doctors/${doctorId}/availability`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, accessToken);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Failed to add availability");
  }
  return res.json();
}

export async function deleteDoctorAvailability(
  availabilityId: string,
  accessToken?: string | null
): Promise<void> {
  const res = await fetchWithAuth(`/api/doctor-availability/${availabilityId}`, { method: "DELETE" }, accessToken);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Failed to delete availability");
  }
}

/** Parse "HH:mm" or "HH:mm:ss" to minutes since midnight */
function timeToMinutes(t: string): number {
  const [h, m] = t.trim().split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Get bookable time slots (HH:mm) for a given day from availability list. Optionally exclude booked times. */
export function getBookableTimesForDay(
  availability: DoctorAvailability[],
  dayOfWeek: number,
  excludeTimes: string[] = []
): string[] {
  const slotsForDay = availability.filter(
    (s) => s.day_of_week === dayOfWeek && s.is_active
  );
  const set = new Set<string>();
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

// --- Patients ---
export type Patient = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  last_visit?: string | null;
  created_at?: string;
};

export async function getPatients(accessToken?: string | null): Promise<Patient[]> {
  const res = await fetchWithAuth("/api/patients", {}, accessToken);
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function createPatient(
  body: { name: string; phone: string; email?: string },
  accessToken?: string | null
): Promise<Patient> {
  const res = await fetchWithAuth("/api/patients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, accessToken);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Failed to add patient");
  }
  return res.json();
}

// --- Appointments ---
export type Appointment = {
  id: string;
  date: string;
  time: string;
  status: "confirmed" | "pending" | "cancelled" | "completed";
  notes?: string | null;
  patient_id: string;
  doctor_id: string;
  patientName: string;
  phone: string;
  doctor: string;
};

export async function getAppointments(
  params?: { date?: string },
  accessToken?: string | null
): Promise<Appointment[]> {
  const search = params?.date ? `?date=${encodeURIComponent(params.date)}` : "";
  const res = await fetchWithAuth(`/api/appointments${search}`, {}, accessToken);
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function createAppointment(
  body: { patient_id: string; doctor_id: string; date: string; time: string; status?: string; notes?: string },
  accessToken?: string | null
): Promise<Appointment> {
  const res = await fetchWithAuth("/api/appointments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, accessToken);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Failed to create appointment");
  }
  return res.json();
}

export async function deleteAppointment(id: string, accessToken?: string | null): Promise<void> {
  const res = await fetchWithAuth(`/api/appointments/${id}`, { method: "DELETE" }, accessToken);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Failed to delete appointment");
  }
}
