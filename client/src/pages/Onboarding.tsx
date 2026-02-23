import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { postOnboarding } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { Activity } from "lucide-react";

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, profile, session, loading, meLoading, refreshMe } = useAuth();

  useEffect(() => {
    if (loading || meLoading) return;
    if (!user) navigate("/login", { replace: true });
    if (user && profile) navigate("/", { replace: true });
  }, [user, profile, loading, meLoading, navigate]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    hospitalName: "",
    email: "",
    phone: "",
    address: "",
    fullName: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.hospitalName.trim()) {
      setError("Hospital name is required.");
      return;
    }
    setSubmitting(true);
    try {
      await postOnboarding(
        {
          hospitalName: form.hospitalName.trim(),
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          address: form.address.trim() || undefined,
          fullName: form.fullName.trim() || undefined,
        },
        session?.access_token
      );
      await refreshMe();
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || meLoading) return null;
  if (!user) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6 rounded-lg border border-border bg-card p-8 shadow-sm">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
            <Activity className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-semibold">Set up your hospital</h1>
          <p className="text-center text-sm text-muted-foreground">
            Enter your hospital details to get started.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hospitalName">Hospital name *</Label>
            <Input
              id="hospitalName"
              value={form.hospitalName}
              onChange={(e) => setForm((f) => ({ ...f, hospitalName: e.target.value }))}
              placeholder="e.g. City General Hospital"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="hospital@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="+1 555-000-0000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="123 Main St, City"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fullName">Your full name</Label>
            <Input
              id="fullName"
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              placeholder="Dr. Jane Smith"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Creating…" : "Continue"}
          </Button>
        </form>
      </div>
    </div>
  );
}
