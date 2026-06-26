import { type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface RouteGuardProps {
  children: ReactNode;
  /** Require user to be signed in. Defaults to true. */
  requireAuth?: boolean;
  /** Require ANY of these roles. */
  anyRole?: AppRole[];
  /** Require ALL of these roles. */
  allRoles?: AppRole[];
}

export function RouteGuard({
  children,
  requireAuth = true,
  anyRole,
  allRoles,
}: RouteGuardProps) {
  const { user, loading, roles, isSuperadmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (requireAuth && !user) {
    return <Navigate to="/auth" state={{ from: location.pathname }} replace />;
  }

  // Superadmin bypasses all role checks
  if (!isSuperadmin) {
    if (anyRole && anyRole.length > 0 && !anyRole.some((r) => roles.includes(r))) {
      return <Forbidden required={anyRole.join(" or ")} />;
    }
    if (allRoles && allRoles.length > 0 && !allRoles.every((r) => roles.includes(r))) {
      return <Forbidden required={allRoles.join(" and ")} />;
    }
  }

  return <>{children}</>;
}

function Forbidden({ required }: { required: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <ShieldAlert className="h-12 w-12 text-destructive" />
      <div>
        <h2 className="text-2xl font-semibold">Access Denied</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This area requires the <span className="font-mono text-foreground">{required}</span> role.
          Ask a superadmin to grant you access.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link to="/">Back to Dashboard</Link>
      </Button>
    </div>
  );
}
