"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Camera,
  FileBarChart2,
  FileText,
  LayoutDashboard,
  ListChecks,
  Menu,
  Plus,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, Monogram } from "@/components/ui";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/contracts", label: "Contracts", icon: FileText },
  { href: "/deliverables", label: "Deliverables", icon: ListChecks },
  { href: "/evidence", label: "Evidence", icon: Camera },
  { href: "/recaps", label: "Recap Reports", icon: FileBarChart2 },
  { href: "/assistant", label: "Assistant", icon: Sparkles },
];

const TEAM = { name: "Harbor City Breakers", league: "Continental Basketball League" };

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col bg-ink-900 text-ink-100">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-white">PartnerProof</div>
          <div className="text-[11px] text-ink-400">Sponsorship Fulfillment</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV.map((item) => {
          const active = isActive(pathname, item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                active
                  ? "bg-white/10 text-white"
                  : "text-ink-300 hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon
                className={cn(
                  "h-[18px] w-[18px] transition",
                  active ? "text-brand-300" : "text-ink-400 group-hover:text-ink-200"
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Team identity */}
      <div className="m-3 rounded-xl bg-white/5 p-3">
        <div className="flex items-center gap-2.5">
          <Monogram name={TEAM.name} size="md" />
          <div className="min-w-0 leading-tight">
            <div className="truncate text-xs font-semibold text-white">{TEAM.name}</div>
            <div className="truncate text-[11px] text-ink-400">{TEAM.league}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const current = NAV.find((item) => isActive(pathname, item));

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-ink-900/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 w-64 animate-fade-in">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}

      {/* Main column */}
      <div className="flex min-h-screen flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-ink-200 bg-white/80 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileOpen(true)}
              className="focus-ring -ml-1 rounded-lg p-2 text-ink-500 hover:bg-ink-100 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-sm font-semibold text-ink-900">
              {current?.label ?? "PartnerProof"}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/contracts/new">
              <Button size="sm" icon={<Plus className="h-4 w-4" />}>
                <span className="hidden sm:inline">New contract</span>
                <span className="sm:hidden">New</span>
              </Button>
            </Link>
            <Monogram name="Jordan Avery" size="sm" />
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>

      {/* Close mobile button (top-right) when drawer open */}
      {mobileOpen ? (
        <button
          onClick={() => setMobileOpen(false)}
          className="fixed right-4 top-4 z-50 rounded-lg bg-white/10 p-2 text-white lg:hidden"
          aria-label="Close navigation"
        >
          <X className="h-5 w-5" />
        </button>
      ) : null}
    </div>
  );
}
