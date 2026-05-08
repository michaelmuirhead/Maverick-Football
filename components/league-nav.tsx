"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function LeagueNav() {
  const path = usePathname() ?? "";
  const tabs = [
    { href: "/league/standings", label: "Standings" },
    { href: "/league/schedule", label: "Schedule" },
    { href: "/league/stats", label: "Stats" },
    { href: "/league/playoffs", label: "Playoffs" },
    { href: "/league/teams", label: "Teams" },
    { href: "/league/records", label: "Records" },
    { href: "/league/coaching-tree", label: "Coach Trees" },
    { href: "/hall-of-fame", label: "Hall of Fame" },
  ];
  return (
    <nav className="scrollbar-thin -mx-3 flex gap-1 overflow-x-auto px-3 sm:mx-0 sm:px-0">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            "shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium tap",
            path.startsWith(t.href) ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface text-muted hover:bg-surface2",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
