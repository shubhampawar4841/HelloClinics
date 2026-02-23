export interface Appointment {
  id: string;
  time: string;
  date: string;
  patientName: string;
  phone: string;
  doctor: string;
  status: "confirmed" | "pending" | "cancelled" | "completed";
}

export interface Patient {
  id: string;
  name: string;
  phone: string;
  lastVisit: string;
}

// Doctor type for API is in @/api/client. Mock doctors kept for Appointments dropdown until that page uses API.
export interface Doctor {
  id: string;
  name: string;
  specialization: string;
}
export const mockDoctors: Doctor[] = [
  { id: "1", name: "Dr. Sarah Chen", specialization: "Cardiology" },
  { id: "2", name: "Dr. James Wilson", specialization: "Neurology" },
  { id: "3", name: "Dr. Emily Park", specialization: "Pediatrics" },
  { id: "4", name: "Dr. Michael Ross", specialization: "Orthopedics" },
  { id: "5", name: "Dr. Lisa Kumar", specialization: "Dermatology" },
];

export const mockPatients: Patient[] = [
  { id: "1", name: "Alice Johnson", phone: "+1 555-0101", lastVisit: "2026-02-18" },
  { id: "2", name: "Bob Smith", phone: "+1 555-0102", lastVisit: "2026-02-15" },
  { id: "3", name: "Carol Davis", phone: "+1 555-0103", lastVisit: "2026-02-20" },
  { id: "4", name: "David Lee", phone: "+1 555-0104", lastVisit: "2026-02-10" },
  { id: "5", name: "Eva Martinez", phone: "+1 555-0105", lastVisit: "2026-02-19" },
  { id: "6", name: "Frank Brown", phone: "+1 555-0106", lastVisit: "2026-02-12" },
  { id: "7", name: "Grace Kim", phone: "+1 555-0107", lastVisit: "2026-02-21" },
  { id: "8", name: "Henry Wilson", phone: "+1 555-0108", lastVisit: "2026-02-14" },
];

export const mockAppointments: Appointment[] = [
  { id: "1", time: "09:00", date: "2026-02-21", patientName: "Alice Johnson", phone: "+1 555-0101", doctor: "Dr. Sarah Chen", status: "confirmed" },
  { id: "2", time: "09:30", date: "2026-02-21", patientName: "Bob Smith", phone: "+1 555-0102", doctor: "Dr. James Wilson", status: "pending" },
  { id: "3", time: "10:00", date: "2026-02-21", patientName: "Carol Davis", phone: "+1 555-0103", doctor: "Dr. Emily Park", status: "confirmed" },
  { id: "4", time: "10:30", date: "2026-02-21", patientName: "David Lee", phone: "+1 555-0104", doctor: "Dr. Michael Ross", status: "completed" },
  { id: "5", time: "11:00", date: "2026-02-21", patientName: "Eva Martinez", phone: "+1 555-0105", doctor: "Dr. Sarah Chen", status: "cancelled" },
  { id: "6", time: "11:30", date: "2026-02-21", patientName: "Frank Brown", phone: "+1 555-0106", doctor: "Dr. Lisa Kumar", status: "confirmed" },
  { id: "7", time: "14:00", date: "2026-02-21", patientName: "Grace Kim", phone: "+1 555-0107", doctor: "Dr. James Wilson", status: "pending" },
  { id: "8", time: "14:30", date: "2026-02-21", patientName: "Henry Wilson", phone: "+1 555-0108", doctor: "Dr. Emily Park", status: "confirmed" },
  { id: "9", time: "09:00", date: "2026-02-20", patientName: "Alice Johnson", phone: "+1 555-0101", doctor: "Dr. Sarah Chen", status: "completed" },
  { id: "10", time: "10:00", date: "2026-02-19", patientName: "Bob Smith", phone: "+1 555-0102", doctor: "Dr. James Wilson", status: "completed" },
  { id: "11", time: "11:00", date: "2026-02-18", patientName: "Carol Davis", phone: "+1 555-0103", doctor: "Dr. Emily Park", status: "completed" },
  { id: "12", time: "09:30", date: "2026-02-17", patientName: "David Lee", phone: "+1 555-0104", doctor: "Dr. Michael Ross", status: "completed" },
  { id: "13", time: "10:30", date: "2026-02-16", patientName: "Eva Martinez", phone: "+1 555-0105", doctor: "Dr. Sarah Chen", status: "cancelled" },
  { id: "14", time: "14:00", date: "2026-02-15", patientName: "Frank Brown", phone: "+1 555-0106", doctor: "Dr. Lisa Kumar", status: "completed" },
];

export const chartWeeklyData = [
  { day: "Mon", appointments: 12 },
  { day: "Tue", appointments: 18 },
  { day: "Wed", appointments: 15 },
  { day: "Thu", appointments: 22 },
  { day: "Fri", appointments: 19 },
  { day: "Sat", appointments: 8 },
  { day: "Sun", appointments: 5 },
];

export const chartDoctorData = [
  { name: "Dr. Chen", appointments: 28 },
  { name: "Dr. Wilson", appointments: 22 },
  { name: "Dr. Park", appointments: 19 },
  { name: "Dr. Ross", appointments: 15 },
  { name: "Dr. Kumar", appointments: 12 },
];

export const chartStatusData = [
  { name: "Confirmed", value: 45, color: "hsl(217, 91%, 60%)" },
  { name: "Completed", value: 30, color: "hsl(142, 71%, 45%)" },
  { name: "Pending", value: 15, color: "hsl(38, 92%, 50%)" },
  { name: "Cancelled", value: 10, color: "hsl(0, 72%, 51%)" },
];
