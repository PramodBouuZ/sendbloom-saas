import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  Send,
  BarChart3,
  Settings,
  Shield,
  LogOut,
  Mail,
  ListChecks,
  Ban,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
}

const tenantNav: NavItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Campaigns", to: "/campaigns", icon: Send },
  { label: "Contacts", to: "/contacts", icon: Users },
  { label: "Lists", to: "/lists", icon: ListChecks },
  { label: "Suppressions", to: "/suppressions", icon: Ban },
  { label: "Analytics", to: "/analytics", icon: BarChart3 },
  { label: "Settings", to: "/settings", icon: Settings },
];

const adminNav: NavItem[] = [
  { label: "Admin Overview", to: "/admin", icon: Shield },
  { label: "Tenants", to: "/admin/tenants", icon: Users },
  { label: "Global Activity", to: "/admin/activity", icon: BarChart3 },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, isSuperAdmin, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const showAdmin = isSuperAdmin && location.pathname.startsWith("/admin");
  const nav = showAdmin ? adminNav : tenantNav;

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex md:w-64 flex-col bg-sidebar text-sidebar-foreground">
        <div className="flex h-16 items-center gap-2 px-6 border-b border-sidebar-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
            <Mail className="h-5 w-5 text-accent-foreground" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight">BANTConfirm</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.to || location.pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}

          {isSuperAdmin && !showAdmin && (
            <Link
              to="/admin"
              className="mt-6 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium bg-accent/10 text-accent hover:bg-accent/20"
            >
              <Shield className="h-4 w-4" />
              Switch to Admin
            </Link>
          )}
          {showAdmin && (
            <Link
              to="/dashboard"
              className="mt-6 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium bg-accent/10 text-accent hover:bg-accent/20"
            >
              <LayoutDashboard className="h-4 w-4" />
              Back to Workspace
            </Link>
          )}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent text-sm font-semibold">
              {profile?.display_name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{profile?.display_name ?? "User"}</p>
              <p className="truncate text-xs text-sidebar-foreground/60">{profile?.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden flex h-14 items-center justify-between border-b bg-card px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Mail className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display font-bold">BANTConfirm</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </header>

        <div className="flex-1 overflow-auto">{children}</div>
      </main>
    </div>
  );
}
