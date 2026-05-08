"use client";
import { useState } from "react";
import Link from "next/link";
import { useLeague } from "@/lib/store/league";
import { LeagueNav } from "@/components/league-nav";
import { Empty, Panel, Section } from "@/components/panels";
import { TEAMS, TEAMS_BY_ID } from "@/lib/data/teams";
import { TeamLogo } from "@/components/team-logo";
import { RECORD_LABELS, RECORD_CATEGORIES, type RecordCategory } from "@/lib/cpu/records";
import { cn } from "@/lib/utils";

type Scope = "league" | "franchise";
type Tier = "career" | "season" | "game";

export default function RecordsPage() {
  const league = useLeague((s) => s.league);
  const [scope, setScope] = useState<Scope>("league");
  const [team, setTeam] = useState<string>(league?.userTeam ?? "BUF");
  const [tier, setTier] = useState<Tier>("career");
  const [cat, setCat] = useState<RecordCategory | "ALL">("ALL");

  if (!league) return <Empty>No league yet.</Empty>;

  const book = scope === "franchise"
    ? league.franchises[team]?.records ?? { career: {}, season: {}, game: {} }
    : league.records;

  const tierBook = book[tier];
  const cats = cat === "ALL" ? RECORD_CATEGORIES : [cat];

  return (
    <div className="space-y-4">
      <LeagueNav />

      <Section title="All-Time Records">
        <div className="space-y-3">
          {/* Scope */}
          <div className="flex flex-wrap gap-2">
            <FilterPill active={scope === "league"} onClick={() => setScope("league")}>League-wide</FilterPill>
            <FilterPill active={scope === "franchise"} onClick={() => setScope("franchise")}>Franchise</FilterPill>
            {scope === "franchise" && (
              <select value={team} onChange={(e) => setTeam(e.target.value)} className="rounded-md border border-border bg-bg px-3 py-1.5 text-xs">
                {TEAMS.map((t) => <option key={t.id} value={t.id}>{t.city} {t.name}</option>)}
              </select>
            )}
          </div>

          {/* Tier */}
          <div className="flex flex-wrap gap-2">
            <FilterPill active={tier === "career"} onClick={() => setTier("career")}>Career</FilterPill>
            <FilterPill active={tier === "season"} onClick={() => setTier("season")}>Single Season</FilterPill>
            <FilterPill active={tier === "game"} onClick={() => setTier("game")}>Single Game</FilterPill>
          </div>

          {/* Category */}
          <div className="scrollbar-thin -mx-3 flex gap-1 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0">
            <FilterPill active={cat === "ALL"} onClick={() => setCat("ALL")}>All categories</FilterPill>
            {RECORD_CATEGORIES.map((c) => (
              <FilterPill key={c} active={cat === c} onClick={() => setCat(c)}>{RECORD_LABELS[c]}</FilterPill>
            ))}
          </div>
        </div>

        <Panel title={`${scope === "franchise" ? `${TEAMS_BY_ID[team].abbr} ` : ""}${tier === "career" ? "Career" : tier === "season" ? "Single Season" : "Single Game"} Records`}>
          <ul className="divide-y divide-border/60">
            {cats.map((c) => {
              const r = tierBook[c];
              const player = r?.playerId ? league.players[r.playerId] : null;
              const teamObj = r?.teamId ? TEAMS_BY_ID[r.teamId] : null;
              return (
                <li key={c} className="py-2 text-sm">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] uppercase tracking-wider text-muted">{RECORD_LABELS[c]}</span>
                    <span className="font-mono text-base font-bold tabular-nums">{r?.value ?? "—"}</span>
                  </div>
                  {player && (
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                      {teamObj && <TeamLogo team={teamObj} size={14} />}
                      <Link href={`/player/${player.id}`} className="truncate hover:text-accent">
                        {player.firstName} {player.lastName}
                      </Link>
                      {r?.year !== undefined && <span>· {r.year}{r.week ? ` Wk${r.week}` : ""}</span>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>
      </Section>
    </div>
  );
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={cn(
        "shrink-0 rounded-md border px-3 py-1.5 text-xs tap",
        active ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface text-muted hover:bg-surface2",
      )}>
      {children}
    </button>
  );
}
