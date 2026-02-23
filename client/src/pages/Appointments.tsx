import { useState, useEffect, useCallback } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { format, addDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
import {
  getAppointments,
  createAppointment,
  deleteAppointment,
  getDoctors,
  getPatients,
  createPatient,
  getDoctorAvailability,
  getBookableTimesForDay,
  type Appointment,
  type Doctor,
  type Patient,
} from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { StatusBadge } from "@/components/StatusBadge";

type SlotOption = { date: string; time: string; label: string; value: string };

export default function Appointments() {
  const { session } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useNewPatient, setUseNewPatient] = useState(false);
  const [form, setForm] = useState({
    patient_id: "",
    patientName: "",
    patientPhone: "",
    doctor_id: "",
    date: new Date(),
    time: "",
  });
  const [availableSlots, setAvailableSlots] = useState<SlotOption[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const loadDoctors = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const data = await getDoctors(session.access_token);
      setDoctors(data);
    } catch {
      setDoctors([]);
    }
  }, [session?.access_token]);

  const loadPatients = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const data = await getPatients(session.access_token);
      setPatients(data);
    } catch {
      setPatients([]);
    }
  }, [session?.access_token]);

  const loadAppointments = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const dateStr = dateFilter ? format(dateFilter, "yyyy-MM-dd") : undefined;
      const data = await getAppointments({ date: dateStr }, session.access_token);
      setAppointments(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load appointments");
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, dateFilter]);

  useEffect(() => {
    loadDoctors();
    loadPatients();
  }, [loadDoctors, loadPatients]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  // Load all available slots for the next 7 days when doctor is selected
  useEffect(() => {
    if (!form.doctor_id || !session?.access_token) {
      setAvailableSlots([]);
      setForm((f) => (f.time || f.date ? { ...f, date: new Date(), time: "" } : f));
      return;
    }
    let cancelled = false;
    setLoadingSlots(true);
    setAvailableSlots([]);
    setForm((f) => (f.time ? { ...f, time: "" } : f));
    (async () => {
      try {
        const doctorId = form.doctor_id;
        const availability = await getDoctorAvailability(doctorId, session.access_token);
        if (cancelled) return;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dateStrings = Array.from({ length: 7 }, (_, i) =>
          format(addDays(today, i), "yyyy-MM-dd")
        );
        const appointmentsPerDay = await Promise.all(
          dateStrings.map((dateStr) =>
            getAppointments({ date: dateStr }, session.access_token)
          )
        );
        if (cancelled) return;
        const allSlots: SlotOption[] = [];
        for (let i = 0; i < 7; i++) {
          const d = addDays(today, i);
          const dayOfWeek = d.getDay();
          const bookedTimes = appointmentsPerDay[i]!
            .filter((a) => a.doctor_id === doctorId)
            .map((a) => (a.time.length > 5 ? a.time.slice(0, 5) : a.time));
          const times = getBookableTimesForDay(
            availability,
            dayOfWeek,
            bookedTimes
          );
          const dateStr = dateStrings[i]!;
          for (const time of times) {
            const value = `${dateStr}_${time}`;
            allSlots.push({
              date: dateStr,
              time,
              value,
              label: `${format(d, "EEE d MMM")}, ${time.length > 5 ? time.slice(0, 5) : time}`,
            });
          }
        }
        allSlots.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
        setAvailableSlots(allSlots);
        setForm((f) =>
          allSlots.length > 0 && !f.time
            ? {
                ...f,
                date: new Date(allSlots[0]!.date + "T12:00:00"),
                time: allSlots[0]!.time,
              }
            : f
        );
      } catch {
        if (!cancelled) setAvailableSlots([]);
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.doctor_id, session?.access_token]);

  const filtered = appointments.filter((a) => {
    const matchSearch =
      a.patientName.toLowerCase().includes(search.toLowerCase()) ||
      a.doctor.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  const handleAdd = async () => {
    if (!form.doctor_id) return;
    const patientId = useNewPatient
      ? null
      : form.patient_id;
    const newPatientName = useNewPatient ? form.patientName.trim() : "";
    const newPatientPhone = useNewPatient ? form.patientPhone.trim() : "";
    if (useNewPatient && (!newPatientName || !newPatientPhone)) return;
    if (!useNewPatient && !patientId) return;

    setSubmitting(true);
    setError(null);
    try {
      let resolvedPatientId = patientId;
      if (useNewPatient) {
        const newPatient = await createPatient(
          { name: newPatientName, phone: newPatientPhone },
          session?.access_token
        );
        resolvedPatientId = newPatient.id;
        setPatients((prev) => [...prev, newPatient]);
      }

      const created = await createAppointment(
        {
          patient_id: resolvedPatientId,
          doctor_id: form.doctor_id,
          date: format(form.date, "yyyy-MM-dd"),
          time: form.time,
          status: "pending",
        },
        session?.access_token
      );
      setAppointments((prev) => [...prev, created]);
      setModalOpen(false);
      setForm({
        patient_id: "",
        patientName: "",
        patientPhone: "",
        doctor_id: "",
        date: new Date(),
        time: "",
      });
      setAvailableSlots([]);
      setUseNewPatient(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create appointment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      await deleteAppointment(id, session?.access_token);
      setAppointments((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete appointment");
    }
  };

  const timeDisplay = (t: string) => (t.length > 5 ? t.slice(0, 5) : t);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="dashboard-card p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search patients or doctors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn("justify-start text-left font-normal", !dateFilter && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFilter ? format(dateFilter, "PPP") : "Filter by date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateFilter}
                onSelect={setDateFilter}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          <Button onClick={() => setModalOpen(true)} className="ml-auto">
            <Plus className="w-4 h-4 mr-2" /> Add Appointment
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="dashboard-card overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Date</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Time</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Patient</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Phone</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Doctor</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Status</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground text-sm">
                    No appointments found
                  </td>
                </tr>
              ) : (
                filtered.map((a) => (
                  <tr key={a.id} className="border-t border-border table-row-hover transition-colors">
                    <td className="px-6 py-3 text-sm text-foreground">{a.date ? format(new Date(a.date + "T12:00:00"), "PP") : "—"}</td>
                    <td className="px-6 py-3 text-sm font-medium text-foreground">{timeDisplay(a.time)}</td>
                    <td className="px-6 py-3 text-sm text-foreground">{a.patientName}</td>
                    <td className="px-6 py-3 text-sm text-muted-foreground">{a.phone}</td>
                    <td className="px-6 py-3 text-sm text-muted-foreground">{a.doctor}</td>
                    <td className="px-6 py-3">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-6 py-3">
                      <button
                        type="button"
                        onClick={() => handleDelete(a.id)}
                        className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Appointment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Patient</Label>
              <div className="flex gap-2 mb-2">
                <Button
                  type="button"
                  variant={!useNewPatient ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setUseNewPatient(false)}
                >
                  Existing patient
                </Button>
                <Button
                  type="button"
                  variant={useNewPatient ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setUseNewPatient(true)}
                >
                  New patient
                </Button>
              </div>
              {useNewPatient ? (
                <>
                  <Input
                    value={form.patientName}
                    onChange={(e) => setForm({ ...form, patientName: e.target.value })}
                    placeholder="Patient name"
                  />
                  <Input
                    value={form.patientPhone}
                    onChange={(e) => setForm({ ...form, patientPhone: e.target.value })}
                    placeholder="Phone (e.g. +1 555-0000)"
                  />
                  <p className="text-xs text-muted-foreground">Patient will be added to the Patients list automatically.</p>
                </>
              ) : (
                <>
                  <Select
                    value={form.patient_id}
                    onValueChange={(v) => setForm({ ...form, patient_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select patient" />
                    </SelectTrigger>
                    <SelectContent>
                      {patients.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} — {p.phone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {patients.length === 0 && (
                    <p className="text-xs text-muted-foreground">No patients yet, or switch to &quot;New patient&quot; to add one.</p>
                  )}
                </>
              )}
            </div>
            <div className="space-y-2">
              <Label>Doctor</Label>
              <Select
                value={form.doctor_id}
                onValueChange={(v) => setForm({ ...form, doctor_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select doctor" />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} — {d.specialization}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {doctors.length === 0 && (
                <p className="text-xs text-muted-foreground">Add doctors from the Doctors page first.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Available slots (next 7 days)</Label>
              {!form.doctor_id ? (
                <div className="flex h-9 items-center rounded-md border border-input bg-muted px-3 py-1 text-sm text-muted-foreground">
                  Select doctor first
                </div>
              ) : loadingSlots ? (
                <div className="flex h-9 items-center rounded-md border border-input bg-muted px-3 py-1 text-sm text-muted-foreground">
                  Loading slots…
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="flex h-9 items-center rounded-md border border-input bg-muted px-3 py-1 text-sm text-muted-foreground">
                  No slots available for this doctor in the next 7 days
                </div>
              ) : (
                <Select
                  value={
                    form.time
                      ? `${format(form.date, "yyyy-MM-dd")}_${form.time}`
                      : ""
                  }
                  onValueChange={(value) => {
                    const [dateStr, time] = value.split("_");
                    if (dateStr && time)
                      setForm({
                        ...form,
                        date: new Date(dateStr + "T12:00:00"),
                        time,
                      });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a slot" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSlots.map((slot) => (
                      <SelectItem key={slot.value} value={slot.value}>
                        {slot.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={
                submitting ||
                !form.doctor_id ||
                !form.time ||
                (useNewPatient ? !form.patientName.trim() || !form.patientPhone.trim() : !form.patient_id)
              }
            >
              {submitting ? "Adding…" : "Add Appointment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
