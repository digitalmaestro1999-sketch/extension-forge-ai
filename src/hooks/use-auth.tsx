import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export type AppRole = "superadmin" | "admin" | "user";
export type UserStatus = "pending" | "active" | "declined";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roles: AppRole[];
  status: UserStatus | null;
  isSuperadmin: boolean;
  isAdmin: boolean;
  hasRole: (role: AppRole) => boolean;
  refreshRoles: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  roles: [],
  status: null,
  isSuperadmin: false,
  isAdmin: false,
  hasRole: () => false,
  refreshRoles: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [status, setStatus] = useState<UserStatus | null>(null);

  const loadProfile = async (uid: string | undefined) => {
    if (!uid) {
      setRoles([]);
      setStatus(null);
      return;
    }
    const [rolesRes, profileRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("profiles").select("status").eq("user_id", uid).maybeSingle(),
    ]);
    if (!rolesRes.error && rolesRes.data) {
      setRoles(rolesRes.data.map((r) => r.role as AppRole));
    } else {
      setRoles([]);
    }
    if (!profileRes.error && profileRes.data) {
      setStatus((profileRes.data as { status: UserStatus }).status);
    } else {
      setStatus("pending");
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
      setTimeout(() => { void loadProfile(s?.user?.id); }, 0);
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
      void loadProfile(s?.user?.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setRoles([]);
    setStatus(null);
  };

  const hasRole = (r: AppRole) => roles.includes(r);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        roles,
        status,
        isSuperadmin: roles.includes("superadmin"),
        isAdmin: roles.includes("admin") || roles.includes("superadmin"),
        hasRole,
        refreshRoles: () => loadProfile(user?.id),
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
