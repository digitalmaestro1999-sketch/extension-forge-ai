import {
  LayoutDashboard, Wand2, Code2, Plug, TestTube2, Package,
  Upload, Settings, Blocks, Zap, TrendingUp, Layers, FolderOpen, LogOut, User,
  Briefcase, DollarSign, Search, BarChart3, BookOpen, Crown, ShieldCheck, SlidersHorizontal,
  Radio, Brain,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { isPlaceholderRoute } from "@/lib/nav-registry";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

type NavItem = { title: string; url: string; icon: typeof LayoutDashboard; adminOnly?: boolean };

const mainItems: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Trend Discovery", url: "/trends", icon: TrendingUp, adminOnly: true },
  { title: "Create Extension", url: "/create", icon: Wand2 },
  { title: "Wizard Workspace", url: "/wizard", icon: Blocks },
  { title: "AI Builder", url: "/ai-builder", icon: Zap },
  { title: "Batch Queue", url: "/batch", icon: Layers, adminOnly: true },
];

const revenueItems: NavItem[] = [
  { title: "Portfolio", url: "/portfolio", icon: Briefcase },
  { title: "Revenue Tracker", url: "/revenue", icon: BarChart3, adminOnly: true },
  { title: "Monetization", url: "/monetization", icon: DollarSign },
  { title: "Store SEO", url: "/store-seo", icon: Search },
];

const toolItems: NavItem[] = [
  { title: "Projects", url: "/projects", icon: FolderOpen },
  { title: "Code Editor", url: "/editor", icon: Code2 },
  { title: "Templates", url: "/templates", icon: Blocks },
  { title: "API Manager", url: "/api-manager", icon: Plug },
  { title: "Test Extension", url: "/test", icon: TestTube2 },
  { title: "Package", url: "/package", icon: Package },
  { title: "Publish", url: "/publish", icon: Upload },
  { title: "Manage Extension", url: "/manage", icon: SlidersHorizontal },
  { title: "Live Control", url: "/control", icon: Radio },
  { title: "Software Intelligence", url: "/intelligence", icon: Brain },

];

const settingsItems = [
  { title: "Settings", url: "/settings", icon: Settings },
  { title: "User Manual", url: "/manual", icon: BookOpen },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, signOut, isSuperadmin, isAdmin } = useAuth();
  const navigate = useNavigate();

  const renderItems = (items: NavItem[]) =>
    items
      .filter((item) => !item.adminOnly || isAdmin)
      .filter((item) => !isPlaceholderRoute(item.url))
      .map((item) => (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild>
          <NavLink
            to={item.url}
            end={item.url === "/dashboard"}
            className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:bg-sidebar-accent"
            activeClassName="bg-sidebar-accent text-primary font-medium"
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{item.title}</span>}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="p-4">
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-cyber flex items-center justify-center">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gradient-cyber">Extension Forge</h2>
              <p className="text-[10px] text-muted-foreground">AI Extension Factory</p>
            </div>
          </div>
        ) : (
          <div className="h-8 w-8 rounded-lg bg-gradient-cyber flex items-center justify-center mx-auto">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
        )}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Factory</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(mainItems)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Revenue</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(revenueItems)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(toolItems)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>System</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(settingsItems)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {isSuperadmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-amber-400">Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {renderItems([
                  { title: "User Management", url: "/admin/users", icon: Crown },
                ])}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="p-3">
        {user ? (
          <div className={`flex items-center ${collapsed ? "justify-center" : "gap-2"}`}>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{user.email}</p>
                {(isSuperadmin || isAdmin) && (
                  <Badge
                    variant="outline"
                    className={`mt-0.5 text-[9px] px-1 py-0 h-3.5 gap-0.5 ${
                      isSuperadmin
                        ? "border-amber-400/40 text-amber-400"
                        : "border-primary/40 text-primary"
                    }`}
                  >
                    {isSuperadmin ? <Crown className="h-2.5 w-2.5" /> : <ShieldCheck className="h-2.5 w-2.5" />}
                    {isSuperadmin ? "Superadmin" : "Admin"}
                  </Badge>
                )}
              </div>
            )}
            <Button size="sm" variant="ghost" onClick={signOut} className="shrink-0 h-7 w-7 p-0">
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate("/auth")}
            className={collapsed ? "w-7 h-7 p-0" : "w-full"}
          >
            <User className="h-3.5 w-3.5" />
            {!collapsed && <span className="ml-1.5">Sign In</span>}
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
