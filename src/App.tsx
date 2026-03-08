import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import CreateExtension from "./pages/CreateExtension";
import AIBuilder from "./pages/AIBuilder";
import CodeEditorPage from "./pages/CodeEditor";
import Templates from "./pages/Templates";
import ComingSoon from "./pages/ComingSoon";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <DashboardLayout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/create" element={<CreateExtension />} />
            <Route path="/ai-builder" element={<AIBuilder />} />
            <Route path="/editor" element={<CodeEditorPage />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/api-manager" element={<ComingSoon />} />
            <Route path="/test" element={<ComingSoon />} />
            <Route path="/package" element={<ComingSoon />} />
            <Route path="/publish" element={<ComingSoon />} />
            <Route path="/settings" element={<ComingSoon />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </DashboardLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
