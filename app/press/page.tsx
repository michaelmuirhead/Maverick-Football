"use client";
import { useState } from "react";
import Link from "next/link";
import { useLeague } from "@/lib/store/league";
import { Empty, Section } from "@/components/panels";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { TeamLogo } from "@/components/team-logo";
import { cn } from "@/lib/utils";
import { Quote, Mic } from "lucide-react";
import type { PressEventKind, PressItem } from "@/lib/types";

const KIND_FILTERS: { id: PressEventKind | "All"; label: string }[] = [
  { id: "All", label: "All" },
  { id: "PostGameWin", label: "Wins" },
  { id: "PostGameLoss", label: "Losses" },
  { id: "BigTrade", label: "Trades" },
  { id: "BigSigning", label: "Signings" },
  { id: "DraftDay", label: "Draft" },
  { id: "Hire", label: "Hires" },
  { id: "Fire", label: "Firings" },
  { id: "Championship", label: "Championships" },
  { id: "BadSeason", label: "Bad seasons" },
  { id: "MilestoneRecord", label: "Records" },
];

export default function PressPage() {
  const league = useLeague((s) => s.league);
  const [kind, setKind] = useState<PressEventKind | "All">("All");
  const [team, setTeam] = useState<string>("All");
  if (!league) return <Empty>No league yet.</Empty>;

  const items = (league.press ?? [])
    .filter((p) => kind === "All" || p.kind === kind)
    .filter((p) => team === "All" || p.team === team)
    .slice(0, 200);

  return (
    <div className="space-y-4">
      <header className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center gap-3">
          <Mic size={20} className="text-accent" />
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold">Press Conference Feed</h1>
            <p className="text-xs text-muted">{league.press?.length ?? 0} quotes recorded across this dynasty</p>
          </div>
        </div>
      </header>

      <Section title="Filters">
        <div className="space-y-2">
          <div className="scrollbar-thin -mx-3 flex gap-1 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0">
            {KIND_FILTERS.map((f) => (
              <button key={f.id} onClick={() => setKind(f.id)}
                className={cn(
                  "shrink-0 rounded-md border px-3 py-1.5 text-xs tap",
                  kind === f.id ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface text-muted hover:bg-surface2",
                )}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted">Team:</span>
            <select value={team} onChange={(e) => setTeam(e.target.value)} className="rounded-md border border-border bg-bg px-3 py-1 text-xs">
              <option value="All">All teams</option>
              {Object.values(TEAMS_BY_ID).sort((a, b) => a.abbr.localeCompare(b.abbr)).map((t) => (
                <option key={t.id} value={t.id}>{t.city} {t.name}</option>
              ))}
            </select>
          </div>
        </div>
      </Section>

      <Section title={`Quotes (${items.length})`}>
        {items.length === 0 ? (
          <Empty>No press conferences in this filter yet. Sim some games — coaches will eventually have things to say.</Empty>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => <PressCard key={item.id} item={item} />)}
          </ul>
        )}
      </Section>
    </div>
  );
}

function PressCard({ item }: { item: PressItem }) {
  const team = item.team ? TEAMS_BY_ID[item.team] : null;
  return (
    <li className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center gap-2 text-[11px] text-muted">
        {team && <TeamLogo team={team} size={20} />}
        <span className="rounded bg-surface2 px-1.5 py-0.5 font-mono">{item.speakerRole}</span>
        <span className="font-medium text-fg">{item.speaker}</span>
        <span>•</span>
        <span>{item.year}{item.week > 0 ? ` Wk ${item.week}` : ""}</span>
        <span>•</span>
        <span className="rounded bg-bg px-1.5 py-0.5">{labelKind(item.kind)}</span>
        {item.context && <span className="ml-auto truncate text-[10px] italic text-muted">{item.context}</span>}
      </div>
      <blockquote className="mt-2 flex gap-3 border-l-2 border-accent/40 pl-3 italic text-sm text-fg">
        <Quote size={14} className="mt-0.5 shrink-0 text-accent" />
        <span>"{item.quote}"</span>
      </blockquote>
    </li>
  );
}

function labelKind(k: PressEventKind): string {
  switch (k) {
    case "PostGameWin": return "post-win";
    case "PostGameLoss": return "post-loss";
    case "BigTrade": return "trade";
    case "BigSigning": return "signing";
    case "DraftDay": return "draft";
    case "Hire": return "hire";
    case "Fire": return "fire";
    case "Championship": return "champ";
    case "BadSeason": return "bad season";
    case "RookieDebut": return "rookie";
    case "MilestoneRecord": return "record";
  }
}
