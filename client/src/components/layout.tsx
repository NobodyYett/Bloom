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
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { format, differenceInDays } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { usePartnerAccess } from "@/contexts/PartnerContext";

interface LayoutProps {
  children: React.ReactNode;
  dueDate: Date | null;
  setDueDate: (date: Date | null) => void;
  appMode?: "pregnancy" | "infancy";
  babyBirthDate?: Date | null;
}

function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function Layout({ children, dueDate, setDueDate, appMode = "pregnancy", babyBirthDate }: LayoutProps) {
  const [location] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { isPartnerView, momName } = usePartnerAccess();

  // Calculate days remaining for conditional nav item (pregnancy mode only)
  const daysRemaining = dueDate ? differenceInDays(dueDate, new Date()) : null;
  const showBabyArrivedNav = appMode === "pregnancy" && !isPartnerView && daysRemaining !== null && daysRemaining <= 30;

  const NavItem = ({
    href,
    icon: Icon,
    label,
    hidden = false,
    highlight = false,
  }: {
    href: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    label: string;
    hidden?: boolean;
    highlight?: boolean;
  }) => {
    if (hidden) return null;
    
    return (
      <Link href={href}>
        <div
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 cursor-pointer",
            location === href
              ? "bg-primary/10 text-primary font-medium"
              : highlight
              ? "bg-primary/10 text-primary hover:bg-primary/20"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Icon className="w-5 h-5" />
          <span>{label}</span>
        </div>
      </Link>
    );
  };

  const SidebarContent = () => (
    <div 
      className="flex flex-col h-full bg-sidebar/50 backdrop-blur-sm border-r border-sidebar-border"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="p-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
            <Baby className="w-5 h-5" />
          </div>
          <span className="font-serif text-2xl font-semibold tracking-tight">
            Bloom
          </span>
        </div>
        
        {isPartnerView && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 text-xs font-medium mb-6">
            <Users className="w-3 h-3" />
            <span>Partner View</span>
          </div>
        )}

        <nav className="space-y-1 mt-6">
          <NavItem href="/" icon={Heart} label="Today" />
          <NavItem href="/timeline" icon={Calendar} label="Timeline" hidden={isPartnerView} />
          <NavItem href="/journal" icon={BookOpen} label="Journal" hidden={isPartnerView} />
          <NavItem href="/appointments" icon={CalendarDays} label="Appointments" />
          <NavItem href="/settings" icon={Settings} label="Settings" />
        </nav>
      </div>

      <div className="mt-auto p-6 border-t border-sidebar-border space-y-4">
        {!isPartnerView && (
          <div>
            {appMode === "infancy" ? (
              /* INFANCY: Show birth date (read-only) */
              <>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
                  Birth Date
                </label>
                <div className="w-full px-3 py-2 rounded-md border border-input bg-muted/50 text-sm text-foreground">
                  {babyBirthDate ? format(babyBirthDate, "MMMM d, yyyy") : "Not set"}
                </div>
              </>
            ) : (
              /* PREGNANCY: Show due date (editable) */
              <>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Due Date
                  </label>
                  {showBabyArrivedNav && (
                    <Link href="/baby-arrived">
                      <span className="text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer">
                        Baby arrived?
                      </span>
                    </Link>
                  )}
                </div>
                <input
                  type="date"
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={dueDate ? format(dueDate, "yyyy-MM-dd") : ""}
                  onChange={(e) => {
                    const date = e.target.value ? parseLocalDate(e.target.value) : null;
                    setDueDate(date);
                  }}
                />
              </>
            )}
          </div>
        )}

        {isPartnerView && (
          <div className="text-xs text-muted-foreground text-center py-2 px-3 rounded-lg bg-muted/50">
            Some personal details are only visible to {momName || "Mom"}.
          </div>
        )}

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
      <div className="hidden md:block w-64 fixed inset-y-0 z-50">
        <SidebarContent />
      </div>

      {/* Mobile hamburger - subtle floating button, visible on all pages */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden fixed z-50 rounded-full"
        style={{
          top: "calc(env(safe-area-inset-top, 0px) + 12px)",
          left: "calc(env(safe-area-inset-left, 0px) + 16px)",
        }}
        onClick={() => setIsMobileOpen(true)}
      >
        <Menu className="w-5 h-5" />
      </Button>

      {/* Mobile sidebar sheet */}
      <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
        <SheetContent side="left" className="p-0 w-64 border-r border-sidebar-border">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      <main className="flex-1 md:ml-64">
        <div className="max-w-5xl mx-auto px-4 md:px-8 pb-4 md:pb-8 md:pt-8 min-h-screen safe-area-top">
          {children}
        </div>
      </main>
    </div>
  );
}