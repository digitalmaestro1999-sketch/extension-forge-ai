import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { VoiceWidget } from "@/components/VoiceWidget";
import { VoiceOnboarding } from "@/components/VoiceOnboarding";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center border-b border-border px-4 shrink-0">
            <SidebarTrigger />
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-mono">v1.0.0</span>
            </div>
          </header>
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
        <VoiceWidget />
        <VoiceOnboarding />
      </div>
    </SidebarProvider>
  );
}
