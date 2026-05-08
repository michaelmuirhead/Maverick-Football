"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useLeague } from "@/lib/store/league";
import { Home, Trophy, Users, ArrowLeftRight, Briefcase } from "lucide-react";

export function BottomNav() {
  const path = usePathname() ?? "/";
  const league = useLeague((s) => s.league);
  const userTeam = league?.userTeam;
  const pendingOffers = league?.pendingOffers?.filter(
    (o) => o.status === "pending" && (o.toTeam === userTeam || o.fromTeam === userTeam),
  ).length ?? 0;

  const items = [
    { href: "/", label: "Hub", icon: Home, match: (p: string) => p === "/", badge: 0 },
    { href: "/league/standings", label: "League", icon: Trophy, match: (p: string) => p.startsWith("/league"), badge: 0 },
    { href: userTeam ? `/team/${userTeam}` : "/", label: "My Team", icon: Users, match: (p: string) => p.startsWith("/team"), badge: 0 },
    { href: "/front-office", label: "Front Office", icon: Briefcase, match: (p: string) => p.startsWith("/front-office") || p.startsWith("/offseason") || p.startsWith("/saves"), badge: 0 },
    { href: "/trade-center", label: "Trades", icon: ArrowLeftRight, match: (p: string) => p.startsWith("/trade"), badge: pendingOffers },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-bg/95 backdrop-blur sm:hidden">
      <ul className="mx-auto grid max-w-7xl grid-cols-5">
        {items.map((it) => {
          const active = it.match(path);
          const Icon = it.icon;
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] tap",
                  active ? "text-accent" : "text-muted",
                )}
              >
                <Icon size={20} />
                <span>{it.label}</span>
                {it.badge > 0 && (
                  <span className="absolute right-2 top-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-accent px-1 text-[9px] font-bold text-bg">
                    {it.badge}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
