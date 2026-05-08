"use client";
import { use, useState } from "react";
import Link from "next/link";
import { useLeague } from "@/lib/store/league";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { TeamBanner } from "@/components/team-banner";
import { TeamNav } from "@/components/team-nav";
import { Empty, Panel, Section, Stat } from "@/components/panels";
import { ensureStadiumState, effectiveHfa, STADIUM_UPGRADE_COST, STADIUM_UPGRADE_MAX } from "@/lib/cpu/ownerFlair";
import { describeWeather, weatherEmoji } from "@/lib/cpu/weather";
import { Building2, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function StadiumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const league = useLeague((s) => s.league);
  const upgrade = useLeague((s) => s.upgradeStadium);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!league) return <Empty>No league yet.</Empty>;
  const team = TEAMS_BY_ID[id];
  if (!team) return <Empty>Unknown team.</Empty>;

  const isOwner = league.userMode === "Owner" && league.userTeam === team.id;
  const state = league.stadiumStates?.[team.id];
  const hfa = effectiveHfa(league, team.id);
  const atMax = hfa >= STADIUM_UPGRADE_MAX;

  // History of upgrade news
  const upgradeNews = league.news.filter((n) => n.id.startsWith(`stadium-${team.id}-`)).slice(0, 5);

  return (
    <div className="space-y-4">
      <TeamBanner team={team} subtitle={`${team.stadium} · ${team.isIndoor ? "Indoor" : team.climate ?? "Outdoor"}`} />
      <TeamNav teamId={team.id} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Home Field Advantage" value={hfa.toString()} hint={atMax ? "max upgraded" : `${STADIUM_UPGRADE_MAX - hfa} levels remaining`} />
        <Stat label="Surface" value={team.isIndoor ? "Dome 🏟" : "Outdoor"} hint={team.climate ?? "—"} />
        <Stat label="Weather risk" value={team.isIndoor ? "None" : team.climate === "Cold" ? "High (snow/wind)" : team.climate === "Hot" ? "Heat" : "Variable"} />
      </div>

      <Section title="Stadium upgrades">
        <Panel>
          <p className="text-xs text-muted">
            Owners can invest in stadium amenities (lights, seating, surface) to increase home-field advantage. Each upgrade adds <strong>+1 HFA</strong> at a cost of <strong>${STADIUM_UPGRADE_COST}M</strong> in next year's cap (charged as dead cap).
          </p>
          {!isOwner ? (
            <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
              Stadium upgrades are <strong>Owner-mode only</strong>. {league.userMode !== "Owner" && "(Your owner is making these calls.)"}
            </div>
          ) : atMax ? (
            <div className="mt-3 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-200">
              Stadium fully upgraded. Crowd noise at maximum, opposing OL false-starting on every cadence.
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={async () => {
                  setBusy(true);
                  const r = upgrade(team.id);
                  setMsg(r.ok ? `Upgrade approved — HFA up by 1, $${STADIUM_UPGRADE_COST}M added to next year's cap` : `Failed: ${r.reason}`);
                  setBusy(false);
                }}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-bold text-bg tap hover:opacity-90 disabled:opacity-40"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Building2 size={14} />}
                Upgrade stadium (+1 HFA, ${STADIUM_UPGRADE_COST}M next year)
              </button>
              {msg && <span className="text-xs text-muted">{msg}</span>}
            </div>
          )}
        </Panel>
      </Section>

      {upgradeNews.length > 0 && (
        <Section title="Upgrade history">
          <ul className="space-y-1">
            {upgradeNews.map((n) => (
              <li key={n.id} className="rounded-md border border-border bg-surface px-3 py-2 text-xs">
                <span className="font-mono text-muted">{n.year}</span> · {n.headline}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Link href={`/team/${team.id}`} className="text-sm text-muted hover:text-fg">
        ← Back to team page
      </Link>
    </div>
  );
}
