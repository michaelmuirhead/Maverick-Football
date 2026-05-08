"use client";
import { useState } from "react";
import { useLeague } from "@/lib/store/league";
import { Empty, Section } from "@/components/panels";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { TeamLogo } from "@/components/team-logo";
import { cn } from "@/lib/utils";
import type { NewsItem } from "@/lib/types";

const CATEGORIES: { id: NewsItem["category"] | "All"; label: string }[] = [
  { id: "All", label: "All" },
  { id: "Game", label: "Games" },
  { id: "Trade", label: "Trades" },
  { id: "FA", label: "Free Agency" },
  { id: "Draft", label: "Draft" },
  { id: "Injury", label: "Injuries" },
  { id: "Award", label: "Awards" },
  { id: "Retire", label: "Retirements" },
  { id: "League", label: "League" },
];

export default function NewsPage() {
  const league = useLeague((s) => s.league);
  const [filter, setFilter] = useState<NewsItem["category"] | "All">("All");
  if (!league) return <Empty>No league yet.</Empty>;

  const filtered = filter === "All" ? league.news : league.news.filter((n) => n.category === filter);
  const news = filtered.slice(0, 200);

  return (
    <div className="space-y-4">
      <Section title="News & Headlines">
        <div className="scrollbar-thin -mx-3 flex gap-1 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0">
          {CATEGORIES.map((c) => {
            const count = c.id === "All" ? league.news.length : league.news.filter((n) => n.category === c.id).length;
            return (
              <button key={c.id} onClick={() => setFilter(c.id)}
                className={cn(
                  "shrink-0 inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs tap",
                  filter === c.id ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface text-muted hover:bg-surface2",
                )}>
                {c.label}
                <span className="rounded bg-bg px-1.5 py-0.5 font-mono text-[10px]">{count}</span>
              </button>
            );
          })}
        </div>

        <ul className="space-y-2">
          {news.map((n) => (
            <li key={n.id} className="flex items-start gap-3 rounded-md border border-border bg-surface p-3">
              <span className="mt-0.5 grid h-7 w-7 place-items-center rounded-md bg-surface2 text-[10px] font-bold uppercase text-muted">
                {n.category.slice(0, 2)}
              </span>
              <div className="flex-1">
                <div className="text-sm">{n.headline}</div>
                {n.body && <div className="text-xs text-muted">{n.body}</div>}
                <div className="mt-1 text-[10px] uppercase tracking-wider text-muted">
                  {n.year}{n.week > 0 ? ` • Wk ${n.week}` : " • Offseason"}
                </div>
              </div>
              {n.teamId && <TeamLogo team={TEAMS_BY_ID[n.teamId]} size={20} />}
            </li>
          ))}
          {news.length === 0 && <Empty>No news in this category yet.</Empty>}
        </ul>
      </Section>
    </div>
  );
}
