import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ShieldCheck, Crown, User as UserIcon, Loader2, Search, RefreshCw,
  ShieldAlert, Mail, Calendar, Check, X, Clock, UserCheck, UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole, type UserStatus } from "@/hooks/use-auth";
import { useNavigate } from "react-router-dom";

interface AdminUserRow {
  user_id: string;
  email: string;
  display_name: string;
  status: UserStatus;
  created_at: string;
  last_sign_in_at: string | null;
  roles: AppRole[];
}

const ALL_ROLES: { value: AppRole; label: string; icon: typeof Crown; tone: string }[] = [
  { value: "superadmin", label: "Superadmin", icon: Crown, tone: "text-amber-400 border-amber-400/30 bg-amber-400/5" },
  { value: "admin",      label: "Admin",      icon: ShieldCheck, tone: "text-primary border-primary/30 bg-primary/5" },
  { value: "user",       label: "User",       icon: UserIcon, tone: "text-muted-foreground border-border bg-muted/20" },
];

const STATUS_STYLE: Record<UserStatus, string> = {
  pending: "border-amber-400/40 text-amber-400 bg-amber-400/5",
  active: "border-emerald-400/40 text-emerald-400 bg-emerald-400/5",
  declined: "border-destructive/40 text-destructive bg-destructive/5",
};

export default function AdminUsers() {
  const { user, isSuperadmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_users");
    if (error) {
      toast.error(error.message || "Failed to load users");
      setRows([]);
    } else {
      setRows((data as AdminUserRow[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth", { replace: true });
      return;
    }
    if (!isSuperadmin) return;
    void load();
  }, [authLoading, user, isSuperadmin, navigate, load]);

  const toggleRole = async (target: AdminUserRow, role: AppRole) => {
    const has = target.roles.includes(role);
    setBusy(target.user_id + role);
    try {
      if (has) {
        if (role === "superadmin" && target.user_id === user?.id) {
          toast.error("You can't revoke your own superadmin role");
          return;
        }
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", target.user_id)
          .eq("role", role);
        if (error) throw error;
        toast.success(`Revoked ${role} from ${target.display_name}`);
      } else {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: target.user_id, role, granted_by: user?.id ?? null });
        if (error) throw error;
        toast.success(`Granted ${role} to ${target.display_name}`);
      }
      await load();
    } catch (e: any) {
      toast.error(e.message || "Could not update role");
    } finally {
      setBusy(null);
    }
  };

  const setStatus = async (target: AdminUserRow, status: UserStatus) => {
    setBusy(target.user_id + "status");
    try {
      const { error } = await supabase.rpc("admin_set_user_status", {
        _user_id: target.user_id,
        _status: status,
      });
      if (error) throw error;
      toast.success(`${target.display_name} → ${status}`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Could not update status");
    } finally {
      setBusy(null);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSuperadmin) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" /> Access denied
            </CardTitle>
            <CardDescription>
              The user-management console is restricted to superadmins. Ask the platform owner to grant you access.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const filtered = rows.filter((r) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return r.email.toLowerCase().includes(q) || r.display_name.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-full bg-background">
      <div className="border-b border-border bg-card/40 backdrop-blur">
        <div className="px-6 py-5 max-w-[1400px] mx-auto flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Crown className="h-6 w-6 text-amber-400" />
              User & Role Management
            </h1>
            <p className="text-sm text-muted-foreground">
              Grant or revoke roles for every signed-up account. Superadmin only.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-amber-400/40 text-amber-400 text-[10px]">
              <Crown className="h-3 w-3 mr-1" /> Superadmin session
            </Badge>
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-[1400px] mx-auto space-y-4">
        {/* Pending approval queue */}
        {(() => {
          const pending = rows.filter((r) => r.status === "pending");
          if (loading || pending.length === 0) return null;
          return (
            <Card className="border-amber-400/30 bg-amber-400/[0.03]">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-amber-400">
                  <Clock className="h-4 w-4" /> Pending approvals
                  <Badge variant="outline" className="border-amber-400/40 text-amber-400 text-[10px] ml-1">
                    {pending.length}
                  </Badge>
                </CardTitle>
                <CardDescription>New sign-ups waiting for you to approve or decline.</CardDescription>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-border">
                {pending.map((row) => {
                  const isBusy = busy === row.user_id + "status";
                  return (
                    <div key={row.user_id} className="px-5 py-3 flex flex-wrap items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-amber-400/20 text-amber-400 flex items-center justify-center font-semibold text-sm shrink-0">
                        {row.display_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">{row.display_name}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate">{row.email}</p>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        Joined {new Date(row.created_at).toLocaleDateString()}
                      </span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" disabled={isBusy}
                          className="border-destructive/40 text-destructive hover:bg-destructive/10"
                          onClick={() => setStatus(row, "declined")}>
                          <UserX className="h-3.5 w-3.5 mr-1" /> Decline
                        </Button>
                        <Button size="sm" disabled={isBusy}
                          className="bg-emerald-500 text-white hover:bg-emerald-600"
                          onClick={() => setStatus(row, "active")}>
                          {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5 mr-1" />}
                          Approve
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })()}

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <CardTitle className="text-base">All accounts</CardTitle>
                <CardDescription>{rows.length} signed-up users</CardDescription>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search email or name…"
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-16 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                No users match your search.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((row) => (
                  <motion.div
                    key={row.user_id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="px-5 py-4 flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-6"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="h-9 w-9 rounded-lg bg-gradient-cyber flex items-center justify-center text-primary-foreground shrink-0 font-semibold text-sm">
                        {row.display_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold truncate">{row.display_name}</p>
                          {row.user_id === user.id && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0">you</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground font-mono truncate flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {row.email}
                        </p>
                      </div>
                    </div>

                    <Badge variant="outline" className={`text-[10px] ${STATUS_STYLE[row.status]}`}>
                      {row.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                      {row.status === "active" && <Check className="h-3 w-3 mr-1" />}
                      {row.status === "declined" && <X className="h-3 w-3 mr-1" />}
                      {row.status}
                    </Badge>

                    {row.status !== "active" && row.user_id !== user.id && (
                      <Button size="sm" variant="outline" className="h-7 text-xs"
                        disabled={busy === row.user_id + "status"}
                        onClick={() => setStatus(row, "active")}>
                        <UserCheck className="h-3 w-3 mr-1" /> Activate
                      </Button>
                    )}
                    {row.status === "active" && row.user_id !== user.id && (
                      <Button size="sm" variant="outline" className="h-7 text-xs border-destructive/40 text-destructive hover:bg-destructive/10"
                        disabled={busy === row.user_id + "status"}
                        onClick={() => setStatus(row, "declined")}>
                        <UserX className="h-3 w-3 mr-1" /> Revoke access
                      </Button>
                    )}

                    <div className="hidden xl:flex flex-col text-[11px] text-muted-foreground min-w-[160px]">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Joined {new Date(row.created_at).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1 mt-0.5">
                        <Check className="h-3 w-3" /> Last seen{" "}
                        {row.last_sign_in_at
                          ? new Date(row.last_sign_in_at).toLocaleDateString()
                          : "never"}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {ALL_ROLES.map(({ value, label, icon: Icon, tone }) => {
                        const has = row.roles.includes(value);
                        const isBusy = busy === row.user_id + value;
                        const isSelfSuper = value === "superadmin" && row.user_id === user.id;
                        return (
                          <button
                            key={value}
                            onClick={() => toggleRole(row, value)}
                            disabled={isBusy || isSelfSuper}
                            className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border transition disabled:opacity-50 disabled:cursor-not-allowed ${
                              has ? tone : "border-border bg-card hover:bg-muted/40 text-muted-foreground"
                            }`}
                            title={
                              isSelfSuper
                                ? "You can't revoke your own superadmin role"
                                : has
                                ? `Revoke ${label}`
                                : `Grant ${label}`
                            }
                          >
                            {isBusy ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : has ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <X className="h-3 w-3 opacity-60" />
                            )}
                            <Icon className="h-3 w-3" />
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
