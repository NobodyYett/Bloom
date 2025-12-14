// client/src/components/layout.tsx (FINAL VERSION)

import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Calendar,
  CalendarDays,
  Heart,
  Baby,
  BookOpen,
  Settings,
  Menu,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

interface LayoutProps {
  children: React.ReactNode;
  // FIX: Change type from Date | undefined to Date | null
  dueDate: Date | null; 
  // FIX: Change function signature from Date | undefined to Date | null
  setDueDate: (date: Date | null) => void; 
}

export function Layout({ children, dueDate, setDueDate }: LayoutProps) {
  const [location] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { user, signOut } = useAuth();

  const NavItem = ({
    href,
    icon: Icon,
    label,
  }: {
    href: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    label: string;
  }) => (
    <Link href={href}>
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 cursor-pointer",
          location === href
            ? "bg-primary/10 text-primary font-medium"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <Icon className="w-5 h-5" />
        <span>{label}</span>
      </div>
    </Link>
  );

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-sidebar/50 backdrop-blur-sm border-r border-sidebar-border">
      <div className="p-6">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
            <Baby className="w-5 h-5" />
          </div>
          <span className="font-serif text-2xl font-semibold tracking-tight">
            Bump Planner
          </span>
        </div>

        {/* Main nav */}
        <nav className="space-y-1">
          <NavItem href="/" icon={Heart} label="Today" />
          <NavItem href="/timeline" icon={Calendar} label="Timeline" />
          <NavItem href="/journal" icon={BookOpen} label="Journal" />
          <NavItem href="/appointments" icon={CalendarDays} label="Appointments" />
          {/* Added Settings Link */}
          <NavItem href="/settings" icon={Settings} label="Settings" />
        </nav>
      </div>

      <div className="mt-auto p-6 border-t border-sidebar-border space-y-4">
        {/* Due date control */}
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
            Due Date
          </label>
          <input
            type="date"
            className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={dueDate ? format(dueDate, "yyyy-MM-dd") : ""}
            onChange={(e) => {
              // FIX: Pass null instead of undefined if the date input is cleared
              const date = e.target.value ? new Date(e.target.value) : null;
              setDueDate(date);
            }}
          />
        </div>

        {/* User + Logout */}
        {user && (
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex-1 truncate text-muted-foreground">
              <div className="font-medium truncate">
                {user.user_metadata?.full_name || user.email}
              </div>
              <div className="truncate opacity-75">{user.email}</div>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={signOut}
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <div className="hidden md:block w-64 fixed inset-y-0 z-50">
        <SidebarContent />
      </div>

      {/* Mobile Sidebar */}
      <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden fixed top-4 left-4 z-50"
          >
            <Menu className="w-6 h-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64 border-r border-sidebar-border">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 relative">
        <div className="max-w-5xl mx-auto p-4 md:p-8 pt-16 md:pt-8 min-h-screen">
          {children}
        </div>
      </main>
    </div>
  );
}