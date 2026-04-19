import { useEffect, type ReactNode } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { useAuth, type AppRole } from "@/lib/auth-context";

interface ProtectedProps {
  children: ReactNode;
  requiredRoles?: AppRole[];
}

export function Protected({ children, requiredRoles }: ProtectedProps) {
  const { user, roles, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({
        to: "/auth",
        search: { redirect: location.pathname },
      });
      return;
    }
    if (requiredRoles && requiredRoles.length > 0) {
      const ok = requiredRoles.some((r) => roles.includes(r));
      if (!ok) {
        navigate({ to: "/" });
      }
    }
  }, [user, roles, loading, requiredRoles, navigate, location.pathname]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
