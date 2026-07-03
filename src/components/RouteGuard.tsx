import { type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { Loader2, ShieldAlert, Construction } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import PendingAccess from "@/pages/PendingAccess";
import { isPlaceholderRoute, getPlaceholderNote } from "@/lib/nav-registry";

interface RouteGuardProps {
  children: ReactNode;
  requireAuth?: boolean;
  anyRole?: AppRole[];
  allRoles?: AppRole[];
  /** Skip the pending-status gate (e.g. the pending screen itself). */
  skipStatusGate?: boolean;
}

export function RouteGuard({
  children,
  requireAuth = true,
  anyRole,
  allRoles,
  skipStatusGate = false,
}: RouteGuardProps) {
  const { user, loading, roles, isSuperadmin, status } = useAuth();
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

  // Superadmin bypasses the pending gate too
  if (!skipStatusGate && user && !isSuperadmin && status && status !== "active") {
    return <PendingAccess />;
  }

  if (!isSuperadmin) {
    if (anyRole && anyRole.length > 0 && !anyRole.some((r) => roles.includes(r))) {
      return <Forbidden required={anyRole.join(" or ")} />;
    }
    if (allRoles && allRoles.length > 0 && !allRoles.every((r) => roles.includes(r))) {
      return <Forbidden required={allRoles.join(" and ")} />;
    }
  }

  // Placeholder gate: even superadmins land on a "coming soon" screen so we
  // don't ship half-built pages. Bypassing requires removing the entry from
  // `nav-registry.ts`.
  if (isPlaceholderRoute(location.pathname)) {
    return <ComingSoon path={location.pathname} />;
  }

  return <>{children}</>;
}

function ComingSoon({ path }: { path: string }) {
  const note = getPlaceholderNote(path);
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <Construction className="h-12 w-12 text-primary" />
      <div>
        <h2 className="text-2xl font-semibold">Coming Soon</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-md">
          {note ?? "This module is still being built. It will appear in the sidebar once it ships."}
        </p>
      </div>
      <Button asChild variant="outline">
        <Link to="/dashboard">Back to Dashboard</Link>
      </Button>
    </div>
  );
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
        <Link to="/dashboard">Back to Dashboard</Link>
      </Button>
    </div>
  );
}
