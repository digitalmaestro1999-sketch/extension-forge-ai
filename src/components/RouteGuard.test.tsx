import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { RouteGuard } from "./RouteGuard";
import type { AppRole } from "@/hooks/use-auth";

type AuthState = {
  user: { id: string } | null;
  loading: boolean;
  roles: AppRole[];
};

let mockAuth: AuthState = { user: null, loading: false, roles: [] };

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    ...mockAuth,
    session: null,
    isSuperadmin: mockAuth.roles.includes("superadmin"),
    isAdmin:
      mockAuth.roles.includes("admin") || mockAuth.roles.includes("superadmin"),
    hasRole: (r: AppRole) => mockAuth.roles.includes(r),
    refreshRoles: async () => {},
    signOut: async () => {},
  }),
}));

function setAuth(next: Partial<AuthState>) {
  mockAuth = { user: null, loading: false, roles: [], ...next };
}

function renderAt(
  ui: React.ReactNode,
  path = "/protected",
) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/auth" element={<div>Auth Page</div>} />
        <Route path="/" element={<div>Home</div>} />
        <Route path="/protected" element={ui} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RouteGuard", () => {
  it("shows loading spinner while auth is resolving", () => {
    setAuth({ loading: true });
    const { container } = renderAt(
      <RouteGuard>
        <div>secret</div>
      </RouteGuard>,
    );
    expect(container.querySelector(".animate-spin")).toBeTruthy();
    expect(screen.queryByText("secret")).toBeNull();
  });

  it("redirects unauthenticated users to /auth", () => {
    setAuth({ user: null });
    renderAt(
      <RouteGuard>
        <div>secret</div>
      </RouteGuard>,
    );
    expect(screen.getByText("Auth Page")).toBeInTheDocument();
    expect(screen.queryByText("secret")).toBeNull();
  });

  it("renders children when user is signed in and no role required", () => {
    setAuth({ user: { id: "u1" }, roles: ["user"] });
    renderAt(
      <RouteGuard>
        <div>secret</div>
      </RouteGuard>,
    );
    expect(screen.getByText("secret")).toBeInTheDocument();
  });

  it("blocks users missing required anyRole", () => {
    setAuth({ user: { id: "u1" }, roles: ["user"] });
    renderAt(
      <RouteGuard anyRole={["admin"]}>
        <div>secret</div>
      </RouteGuard>,
    );
    expect(screen.getByText("Access Denied")).toBeInTheDocument();
    expect(screen.queryByText("secret")).toBeNull();
  });

  it("allows users with one of the anyRole roles", () => {
    setAuth({ user: { id: "u1" }, roles: ["admin"] });
    renderAt(
      <RouteGuard anyRole={["admin", "superadmin"]}>
        <div>secret</div>
      </RouteGuard>,
    );
    expect(screen.getByText("secret")).toBeInTheDocument();
  });

  it("blocks users missing one of the allRoles", () => {
    setAuth({ user: { id: "u1" }, roles: ["admin"] });
    renderAt(
      <RouteGuard allRoles={["admin", "user"]}>
        <div>secret</div>
      </RouteGuard>,
    );
    expect(screen.getByText("Access Denied")).toBeInTheDocument();
  });

  it("superadmin bypasses all role requirements", () => {
    setAuth({ user: { id: "u1" }, roles: ["superadmin"] });
    renderAt(
      <RouteGuard allRoles={["admin", "user"]}>
        <div>secret</div>
      </RouteGuard>,
    );
    expect(screen.getByText("secret")).toBeInTheDocument();
  });

  it("respects requireAuth=false (public route)", () => {
    setAuth({ user: null });
    renderAt(
      <RouteGuard requireAuth={false}>
        <div>public</div>
      </RouteGuard>,
    );
    expect(screen.getByText("public")).toBeInTheDocument();
  });
});
