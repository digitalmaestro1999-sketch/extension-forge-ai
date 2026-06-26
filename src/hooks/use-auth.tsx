import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export type AppRole = "superadmin" | "admin" | "user";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roles: AppRole[];
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

  const loadRoles = async (uid: string | undefined) => {
    if (!uid) {
      setRoles([]);
      return;
    }
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid);
    if (!error && data) {
      setRoles(data.map((r) => r.role as AppRole));
    } else {
      setRoles([]);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
      // Defer to avoid recursive deadlock with Supabase client
      setTimeout(() => { void loadRoles(s?.user?.id); }, 0);
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
      void loadRoles(s?.user?.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setRoles([]);
  };

  const hasRole = (r: AppRole) => roles.includes(r);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        roles,
        isSuperadmin: roles.includes("superadmin"),
        isAdmin: roles.includes("admin") || roles.includes("superadmin"),
        hasRole,
        refreshRoles: () => loadRoles(user?.id),
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
