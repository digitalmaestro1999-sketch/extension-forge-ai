import { type ReactNode } from "react";
import { Navigate, useLocation, Link } from "react-router-dom";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { Loader2, ShieldAlert, Construction, ArrowLeft, LayoutDashboard, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

  if (isPlaceholderRoute(location.pathname)) {
    return <ComingSoon path={location.pathname} />;
  }

  return <>{children}</>;
}

function ComingSoon({ path }: { path: string }) {
  const note = getPlaceholderNote(path);
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card/60 p-8 shadow-lg backdrop-blur">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-accent/10 blur-3xl" />

        <div className="relative flex flex-col items-start gap-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/30">
              <Construction className="h-6 w-6 text-primary" />
            </div>
            <div>
              <Badge variant="outline" className="border-primary/40 text-primary">
                <Sparkles className="mr-1 h-3 w-3" /> In development
              </Badge>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">{path}</p>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-semibold tracking-tight">This module is on the way</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {note ??
                "We hid this route from the sidebar because it isn't ready for daily use yet. It will light up automatically the moment it ships — no refresh required."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button asChild size="sm">
              <Link to="/dashboard">
                <LayoutDashboard className="mr-1.5 h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/manual">
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Browse the Manual
              </Link>
            </Button>
          </div>
        </div>
      </div>
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
