import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getDoctors,
  createDoctor,
  deleteDoctor,
  getDoctorAvailability,
  createDoctorAvailability,
  deleteDoctorAvailability,
  getDayName,
  type Doctor,
  type DoctorAvailability,
} from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";

const DAY_OPTIONS = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ value: d, label: getDayName(d) }));

function timeDisplay(t: string) {
  return t.length > 5 ? t.slice(0, 5) : t;
}

export default function Doctors() {
  const { session } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: "", specialization: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [availabilityDoctor, setAvailabilityDoctor] = useState<Doctor | null>(null);
  const [availabilitySlots, setAvailabilitySlots] = useState<DoctorAvailability[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [slotForm, setSlotForm] = useState({
    day_of_week: 1,
    start_time: "09:00",
    end_time: "17:00",
    slot_duration_minutes: 15,
  });
  const [slotSubmitting, setSlotSubmitting] = useState(false);

  const loadDoctors = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getDoctors(session.access_token);
      setDoctors(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load doctors");
      setDoctors([]);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    loadDoctors();
  }, [loadDoctors]);

  const handleAdd = async () => {
    if (!form.name.trim() || !form.specialization.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await createDoctor(
        { name: form.name.trim(), specialization: form.specialization.trim() },
        session?.access_token
      );
      setDoctors((prev) => [...prev, created]);
      setModalOpen(false);
      setForm({ name: "", specialization: "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add doctor");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      await deleteDoctor(id, session?.access_token);
      setDoctors((prev) => prev.filter((d) => d.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete doctor");
    }
  };

  const openAvailability = async (doctor: Doctor) => {
    setAvailabilityDoctor(doctor);
    setAvailabilityError(null);
    setAvailabilitySlots([]);
    if (!session?.access_token) return;
    setAvailabilityLoading(true);
    try {
      const data = await getDoctorAvailability(doctor.id, session.access_token);
      setAvailabilitySlots(data);
    } catch (e) {
      setAvailabilityError(e instanceof Error ? e.message : "Failed to load availability");
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const closeAvailability = () => {
    setAvailabilityDoctor(null);
    setAvailabilityError(null);
    setSlotForm({ day_of_week: 1, start_time: "09:00", end_time: "17:00", slot_duration_minutes: 15 });
  };

  const handleAddSlot = async () => {
    if (!availabilityDoctor?.id || !session?.access_token) return;
    setSlotSubmitting(true);
    setAvailabilityError(null);
    try {
      const created = await createDoctorAvailability(
        availabilityDoctor.id,
        {
          day_of_week: slotForm.day_of_week,
          start_time: slotForm.start_time,
          end_time: slotForm.end_time,
          slot_duration_minutes: slotForm.slot_duration_minutes,
        },
        session.access_token
      );
      setAvailabilitySlots((prev) => [...prev, created]);
      setSlotForm({ day_of_week: 1, start_time: "09:00", end_time: "17:00", slot_duration_minutes: 15 });
    } catch (e) {
      setAvailabilityError(e instanceof Error ? e.message : "Failed to add slot");
    } finally {
      setSlotSubmitting(false);
    }
  };

  const handleDeleteSlot = async (id: string) => {
    setAvailabilityError(null);
    try {
      await deleteDoctorAvailability(id, session?.access_token);
      setAvailabilitySlots((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      setAvailabilityError(e instanceof Error ? e.message : "Failed to delete slot");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="dashboard-card p-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">All Doctors</h3>
        <Button onClick={() => setModalOpen(true)}><Plus className="w-4 h-4 mr-2" /> Add Doctor</Button>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="dashboard-card overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Doctor Name</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Specialization</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Availability</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {doctors.map((d) => (
                <tr key={d.id} className="border-t border-border table-row-hover transition-colors">
                  <td className="px-6 py-3 text-sm font-medium text-foreground">{d.name}</td>
                  <td className="px-6 py-3 text-sm text-muted-foreground">{d.specialization}</td>
                  <td className="px-6 py-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => openAvailability(d)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <CalendarClock className="w-4 h-4 mr-1" />
                      Availability
                    </Button>
                  </td>
                  <td className="px-6 py-3">
                    <button
                      type="button"
                      onClick={() => handleDelete(d.id)}
                      className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && doctors.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No doctors yet. Add one above.</p>
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>Add Doctor</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Doctor Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Dr. ..." />
            </div>
            <div className="space-y-2">
              <Label>Specialization</Label>
              <Input value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} placeholder="e.g. Cardiology" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!form.name.trim() || !form.specialization.trim() || submitting}>
              {submitting ? "Adding…" : "Add Doctor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!availabilityDoctor} onOpenChange={(open) => !open && closeAvailability()}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              Availability — {availabilityDoctor?.name}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            {availabilityError && (
              <p className="text-sm text-destructive">{availabilityError}</p>
            )}

            <div className="space-y-2">
              <Label>Add time slot</Label>
              <p className="text-xs text-muted-foreground">Day 0 = Sunday, 6 = Saturday. Slot duration in minutes.</p>
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={String(slotForm.day_of_week)}
                  onValueChange={(v) => setSlotForm({ ...slotForm, day_of_week: Number(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={5}
                  max={120}
                  value={slotForm.slot_duration_minutes}
                  onChange={(e) =>
                    setSlotForm({ ...slotForm, slot_duration_minutes: Number(e.target.value) || 15 })
                  }
                  placeholder="Slot (min)"
                />
              </div>
              <div className="flex gap-2">
                <Input
                  type="time"
                  value={slotForm.start_time}
                  onChange={(e) => setSlotForm({ ...slotForm, start_time: e.target.value })}
                />
                <span className="flex items-center text-muted-foreground">to</span>
                <Input
                  type="time"
                  value={slotForm.end_time}
                  onChange={(e) => setSlotForm({ ...slotForm, end_time: e.target.value })}
                />
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleAddSlot}
                disabled={slotSubmitting}
              >
                {slotSubmitting ? "Adding…" : "Add slot"}
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Current slots</Label>
              {availabilityLoading ? (
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              ) : availabilitySlots.length === 0 ? (
                <p className="text-sm text-muted-foreground">No slots. Add one above.</p>
              ) : (
                <ul className="space-y-2">
                  {availabilitySlots.map((slot) => (
                    <li
                      key={slot.id}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <span>
                        {getDayName(slot.day_of_week)} {timeDisplay(slot.start_time)}–{timeDisplay(slot.end_time)}
                        <span className="text-muted-foreground ml-1">({slot.slot_duration_minutes} min)</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteSlot(slot.id)}
                        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
