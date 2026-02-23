import { useState, useEffect, useMemo } from "react";
import { Calendar as BigCalendar, dateFnsLocalizer, Views } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { getAppointments, type Appointment } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";

const locales = { "en-US": enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

function toCalendarEvent(a: Appointment) {
  const timeStr = (a.time || "").length > 5 ? (a.time || "").slice(0, 5) : a.time || "00:00";
  const start = new Date(`${a.date}T${timeStr}:00`);
  const end = new Date(start.getTime() + 30 * 60000);
  return {
    title: `${a.patientName || "Patient"} — ${a.doctor || "Doctor"}`,
    start,
    end,
  };
}

export default function CalendarPage() {
  const { session } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.access_token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getAppointments({}, session.access_token)
      .then((data) => {
        if (!cancelled) setAppointments(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || "Failed to load appointments");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.access_token]);

  const events = useMemo(
    () => appointments.map(toCalendarEvent),
    [appointments]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="animate-fade-in p-6">
        <div className="dashboard-card p-6 text-center text-muted-foreground">
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="dashboard-card p-6">
        <BigCalendar
          localizer={localizer}
          events={events}
          defaultView={Views.WEEK}
          views={[Views.MONTH, Views.WEEK, Views.DAY]}
          defaultDate={new Date()}
          style={{ height: 650 }}
          popup
        />
      </div>
    </div>
  );
}
