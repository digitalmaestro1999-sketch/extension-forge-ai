import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/use-auth";
import { DashboardLayout } from "@/components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import AuthPage from "./pages/AuthPage";
import CreateExtension from "./pages/CreateExtension";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route
              path="*"
              element={
                <DashboardLayout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/create" element={<CreateExtension />} />
                    <Route path="/ai-builder" element={<AIBuilder />} />
                    <Route path="/editor" element={<CodeEditorPage />} />
                    <Route path="/templates" element={<Templates />} />
                    <Route path="/trends" element={<TrendDiscovery />} />
                    <Route path="/batch" element={<BatchQueue />} />
                    <Route path="/projects" element={<ProjectHistory />} />
                    <Route path="/api-manager" element={<ApiManager />} />
                    <Route path="/test" element={<TestExtension />} />
                    <Route path="/package" element={<PackageExtension />} />
                    <Route path="/publish" element={<PublishAssistant />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </DashboardLayout>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
