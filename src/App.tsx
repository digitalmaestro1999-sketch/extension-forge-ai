import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Navigate } from "react-router-dom";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import AuthPage from "./pages/AuthPage";
import CreateExtension from "./pages/CreateExtension";
import ExtensionWizard from "./pages/ExtensionWizard";
import AIBuilder from "./pages/AIBuilder";
import CodeEditorPage from "./pages/CodeEditor";
import Templates from "./pages/Templates";
import TrendDiscovery from "./pages/TrendDiscovery";
import BatchQueue from "./pages/BatchQueue";
import ProjectHistory from "./pages/ProjectHistory";
import TestExtension from "./pages/TestExtension";
import PackageExtension from "./pages/PackageExtension";
import PublishAssistant from "./pages/PublishAssistant";
import ApiManager from "./pages/ApiManager";
import SettingsPage from "./pages/SettingsPage";
import Portfolio from "./pages/Portfolio";
import MonetizationTemplates from "./pages/MonetizationTemplates";
import StoreSEO from "./pages/StoreSEO";
import RevenueTracker from "./pages/RevenueTracker";
import UserManual from "./pages/UserManual";
import AdminUsers from "./pages/AdminUsers";
import AdminOpsConsole from "./pages/AdminOpsConsole";
import AdminAuditLogs from "./pages/AdminAuditLogs";
import CertifyExtension from "./pages/CertifyExtension";
import StoreAssets from "./pages/StoreAssets";
import ManageExtension from "./pages/ManageExtension";
import LiveControl from "./pages/LiveControl";
import SoftwareIntelligence from "./pages/SoftwareIntelligence";
import ExtensionIntelligence from "./pages/ExtensionIntelligence";
import NotFound from "./pages/NotFound";
import { RouteGuard } from "@/components/RouteGuard";

const queryClient = new QueryClient();

// Role policy: superadmin bypasses all role checks (handled inside RouteGuard).
const adminOnly = ["admin"] as const;
const superadminOnly = ["superadmin"] as const;

// Public landing at `/` for signed-out visitors; redirect to /dashboard when signed-in.
const HomeGate = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Landing />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/" element={<HomeGate />} />
            <Route
              path="*"
              element={
                <RouteGuard>
                  <DashboardLayout>
                    <Routes>
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/create" element={<CreateExtension />} />
                      <Route path="/wizard" element={<ExtensionWizard />} />
                      <Route path="/ai-builder" element={<AIBuilder />} />
                      <Route path="/editor" element={<CodeEditorPage />} />
                      <Route path="/templates" element={<Templates />} />
                      <Route path="/projects" element={<ProjectHistory />} />
                      <Route path="/api-manager" element={<ApiManager />} />
                      <Route path="/test" element={<TestExtension />} />
                      <Route path="/package" element={<PackageExtension />} />
                      <Route path="/publish" element={<PublishAssistant />} />
                      <Route path="/portfolio" element={<Portfolio />} />
                      <Route path="/monetization" element={<MonetizationTemplates />} />
                      <Route path="/store-seo" element={<StoreSEO />} />
                      <Route path="/settings" element={<SettingsPage />} />
                      <Route path="/manual" element={<UserManual />} />
                      <Route path="/manage" element={<ManageExtension />} />
                      <Route path="/control" element={<LiveControl />} />
                      <Route path="/intelligence" element={<ExtensionIntelligence />} />
                      <Route path="/intelligence/codebase" element={<SoftwareIntelligence />} />
                      <Route path="/audit-logs" element={<AdminAuditLogs />} />
                      <Route path="/certify" element={<CertifyExtension />} />
                      <Route path="/store-assets" element={<StoreAssets />} />



                      {/* Admin-tier: scaling / business tools */}
                      <Route
                        path="/trends"
                        element={
                          <RouteGuard anyRole={[...adminOnly]}>
                            <TrendDiscovery />
                          </RouteGuard>
                        }
                      />
                      <Route
                        path="/batch"
                        element={
                          <RouteGuard anyRole={[...adminOnly]}>
                            <BatchQueue />
                          </RouteGuard>
                        }
                      />
                      <Route
                        path="/revenue"
                        element={
                          <RouteGuard anyRole={[...adminOnly]}>
                            <RevenueTracker />
                          </RouteGuard>
                        }
                      />

                      {/* Superadmin only */}
                      <Route
                        path="/admin/users"
                        element={
                          <RouteGuard anyRole={[...superadminOnly]}>
                            <AdminUsers />
                          </RouteGuard>
                        }
                      />
                      <Route
                        path="/admin/ops"
                        element={
                          <RouteGuard anyRole={[...superadminOnly]}>
                            <AdminOpsConsole />
                          </RouteGuard>
                        }
                      />


                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </DashboardLayout>
                </RouteGuard>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
