import { CheckCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

function field(value: string | null, fallback = "—") {
  return value?.trim() ? value : fallback;
}

export default function SettingsPage() {
  const { hospital } = useAuth();

  return (
    <div className="animate-fade-in max-w-2xl">
      <div className="dashboard-card p-6 space-y-6">
        <h3 className="text-sm font-semibold text-foreground">Hospital Information</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-border">
            <span className="text-sm text-muted-foreground">Name</span>
            <span className="text-sm font-medium text-foreground">{field(hospital?.name ?? null, "—")}</span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-border">
            <span className="text-sm text-muted-foreground">Address</span>
            <span className="text-sm font-medium text-foreground">{field(hospital?.address ?? null, "—")}</span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-border">
            <span className="text-sm text-muted-foreground">Phone</span>
            <span className="text-sm font-medium text-foreground">{field(hospital?.phone ?? null, "—")}</span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-border">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-sm font-medium text-foreground">{field(hospital?.email ?? null, "—")}</span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-border">
            <span className="text-sm text-muted-foreground">Twilio Number</span>
            <span className="text-sm font-medium text-foreground">{field(hospital?.twilio_number ?? null, "Not configured")}</span>
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-muted-foreground">System Status</span>
            <span className="status-badge status-confirmed">
              <CheckCircle className="w-3 h-3 mr-1" /> Operational
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
