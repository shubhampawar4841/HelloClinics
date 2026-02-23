import "dotenv/config";
import express from "express";
import cors from "cors";
import onboardingRouter from "./routes/onboarding.js";
import doctorsRouter from "./routes/doctors.js";
import patientsRouter from "./routes/patients.js";
import appointmentsRouter from "./routes/appointments.js";
import doctorAvailabilityRouter from "./routes/doctorAvailability.js";
import voiceRouter from "./routes/voice.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Request logging — log every request to the terminal
app.use((req, res, next) => {
  const start = Date.now();
  const ts = new Date().toISOString();
  const q = Object.keys(req.query).length ? `?${new URLSearchParams(req.query).toString()}` : "";
  console.log(`[${ts}] ${req.method} ${req.path}${q}`);
  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(`[${ts}] ${req.method} ${req.path} → ${res.statusCode} (${ms}ms)`);
  });
  next();
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "MediFlow API is running" });
});

app.use("/api", onboardingRouter);
app.use("/api/doctors", doctorsRouter);
app.use("/api/patients", patientsRouter);
app.use("/api/appointments", appointmentsRouter);
app.use("/api/doctor-availability", doctorAvailabilityRouter);
app.use("/api/voice", voiceRouter);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
