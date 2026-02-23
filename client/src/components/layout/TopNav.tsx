import { useLocation } from "react-router-dom";
import { Bell } from "lucide-react";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/appointments": "Appointments",
  "/calendar": "Calendar",
  "/patients": "Patients",
  "/doctors": "Doctors",
  "/settings": "Settings",
};

export function TopNav() {
  const location = useLocation();
  const title = pageTitles[location.pathname] || "Dashboard";

  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 sticky top-0 z-10">
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground hidden sm:block">MediFlow Hospital</span>
        <button className="relative p-2 rounded-lg hover:bg-muted transition-colors">
          <Bell className="w-[18px] h-[18px] text-muted-foreground" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full" />
        </button>
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
          A
        </div>
      </div>
    </header>
  );
}
