"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function TeamNav({ teamId }: { teamId: string }) {
  const path = usePathname() ?? "";
  const tabs = [
    { href: `/team/${teamId}`, label: "Overview" },
    { href: `/team/${teamId}/roster`, label: "Roster" },
    { href: `/team/${teamId}/depth-chart`, label: "Depth Chart" },
    { href: `/team/${teamId}/practice-squad`, label: "Practice Squad" },
    { href: `/team/${teamId}/coaches`, label: "Coaches" },
    { href: `/team/${teamId}/schedule`, label: "Schedule" },
    { href: `/team/${teamId}/stadium`, label: "Stadium" },
    { href: `/team/${teamId}/finances`, label: "Finances" },
    { href: `/team/${teamId}/edit`, label: "Edit" },
  ];
  return (
    <nav className="scrollbar-thin -mx-3 flex gap-1 overflow-x-auto px-3 sm:mx-0 sm:px-0">
      {tabs.map((t) => {
        const active = t.href === path || (t.href !== `/team/${teamId}` && path.startsWith(t.href));
        return (
          <Link key={t.href} href={t.href}
            className={cn("shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium tap",
              active ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface text-muted hover:bg-surface2")}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
