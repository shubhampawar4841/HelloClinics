import { useState, useEffect, useCallback } from "react";
import { format, subDays } from "date-fns";
import { CalendarDays, Users, Stethoscope, TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  getAppointments,
  getPatients,
  getDoctors,
  type Appointment,
} from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { StatusBadge } from "@/components/StatusBadge";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const STATUS_COLORS: Record<string, string> = {
  confirmed: "hsl(217, 91%, 60%)",
  completed: "hsl(142, 71%, 45%)",
  pending: "hsl(38, 92%, 50%)",
  cancelled: "hsl(0, 72%, 51%)",
};

export default function Dashboard() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [todayCount, setTodayCount] = useState(0);
  const [totalPatients, setTotalPatients] = useState(0);
  const [totalDoctors, setTotalDoctors] = useState(0);
  const [weeklyCount, setWeeklyCount] = useState(0);
  const [chartWeeklyData, setChartWeeklyData] = useState<{ day: string; appointments: number }[]>([]);
  const [chartDoctorData, setChartDoctorData] = useState<{ name: string; appointments: number }[]>([]);
  const [chartStatusData, setChartStatusData] = useState<{ name: string; value: number; color: string }[]>([]);

  const loadDashboard = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const todayStr = format(new Date(), "yyyy-MM-dd");
      const [todayRes, patientsRes, doctorsRes] = await Promise.all([
        getAppointments({ date: todayStr }, session.access_token),
        getPatients(session.access_token),
        getDoctors(session.access_token),
      ]);

      setTodayAppointments(todayRes);
      setTodayCount(todayRes.length);
      setTotalPatients(patientsRes.length);
      setTotalDoctors(doctorsRes.length);

      const last7Days = Array.from({ length: 7 }, (_, i) =>
        format(subDays(new Date(), 6 - i), "yyyy-MM-dd")
      );
      const weekAppointmentsByDay = await Promise.all(
        last7Days.map((date) =>
          getAppointments({ date }, session.access_token)
        )
      );

      const weeklyTotal = weekAppointmentsByDay.reduce((sum, arr) => sum + arr.length, 0);
      setWeeklyCount(weeklyTotal);

      setChartWeeklyData(
        last7Days.map((date, i) => ({
          day: DAY_LABELS[new Date(date).getDay()],
          appointments: weekAppointmentsByDay[i].length,
        }))
      );

      const allWeekAppointments = weekAppointmentsByDay.flat();
      const byDoctor: Record<string, number> = {};
      allWeekAppointments.forEach((a) => {
        const name = a.doctor || "Unknown";
        byDoctor[name] = (byDoctor[name] || 0) + 1;
      });
      setChartDoctorData(
        Object.entries(byDoctor).map(([name, appointments]) => ({ name, appointments }))
      );

      const byStatus: Record<string, number> = {};
      allWeekAppointments.forEach((a) => {
        const s = a.status || "pending";
        byStatus[s] = (byStatus[s] || 0) + 1;
      });
      setChartStatusData(
        Object.entries(byStatus).map(([name, value]) => ({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          value,
          color: STATUS_COLORS[name] || "hsl(var(--muted-foreground))",
        }))
      );
    } catch {
      setTodayAppointments([]);
      setTodayCount(0);
      setTotalPatients(0);
      setTotalDoctors(0);
      setWeeklyCount(0);
      setChartWeeklyData([]);
      setChartDoctorData([]);
      setChartStatusData([]);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const timeDisplay = (t: string) => (t.length > 5 ? t.slice(0, 5) : t);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const stats = [
    { label: "Today's Appointments", value: todayCount, icon: CalendarDays, color: "text-primary" },
    { label: "Total Patients", value: totalPatients, icon: Users, color: "text-[hsl(var(--success))]" },
    { label: "Total Doctors", value: totalDoctors, icon: Stethoscope, color: "text-[hsl(var(--info))]" },
    { label: "Weekly Appointments", value: weeklyCount, icon: TrendingUp, color: "text-[hsl(var(--warning))]" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <p className="text-2xl font-bold text-foreground">{s.value.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="dashboard-card p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Appointments Last 7 Days</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartWeeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid hsl(var(--border))",
                  boxShadow: "var(--shadow-lg)",
                }}
              />
              <Line
                type="monotone"
                dataKey="appointments"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 4, fill: "hsl(var(--primary))" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="dashboard-card p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Appointments per Doctor (7 days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartDoctorData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid hsl(var(--border))",
                  boxShadow: "var(--shadow-lg)",
                }}
              />
              <Bar dataKey="appointments" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="dashboard-card p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Appointment Status (7 days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={chartStatusData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                dataKey="value"
                paddingAngle={4}
              >
                {chartStatusData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid hsl(var(--border))",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-2 justify-center">
            {chartStatusData.map((s) => (
              <div key={s.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                {s.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Today's Appointments Table */}
      <div className="dashboard-card">
        <div className="p-6 pb-4">
          <h3 className="text-sm font-semibold text-foreground">Today's Appointments</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-t border-border">
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">
                  Time
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">
                  Patient
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">
                  Doctor
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {todayAppointments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground text-sm">
                    No appointments today
                  </td>
                </tr>
              ) : (
                todayAppointments.map((a) => (
                  <tr key={a.id} className="border-t border-border table-row-hover transition-colors">
                    <td className="px-6 py-3 text-sm text-foreground font-medium">
                      {timeDisplay(a.time)}
                    </td>
                    <td className="px-6 py-3 text-sm text-foreground">{a.patientName}</td>
                    <td className="px-6 py-3 text-sm text-muted-foreground">{a.doctor}</td>
                    <td className="px-6 py-3">
                      <StatusBadge status={a.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
