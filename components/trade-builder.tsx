"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { League, TradeAsset } from "@/lib/types";
import { TEAMS, TEAMS_BY_ID } from "@/lib/data/teams";
import { TeamLogo } from "./team-logo";
import { useLeague } from "@/lib/store/league";
import { getRoster } from "@/lib/gen/roster";
import { Panel, Stat } from "./panels";
import { cn, gradeColor } from "@/lib/utils";
import {
  baseValueOf, valueOfAssetsTo, pickKeyOf, playerTradeValue, pickTradeValue,
} from "@/lib/cpu/tradeValue";
import { evaluateAcceptance } from "@/lib/cpu/tradeAI";
import { Plus, X, Check, AlertTriangle } from "lucide-react";

interface Props {
  league: League;
  defaultPartner?: string;
}

export function TradeBuilder({ league, defaultPartner }: Props) {
  const userTeamId = league.userTeam!;
  const userTeam = TEAMS_BY_ID[userTeamId];
  const propose = useLeague((s) => s.proposeTradeToTeam);

  const [partner, setPartner] = useState<string>(defaultPartner ?? otherTeams(userTeamId)[0]);
  const [give, setGive] = useState<TradeAsset[]>([]);
  const [get, setGet] = useState<TradeAsset[]>([]);
  const [result, setResult] = useState<{ accepted: boolean; reason: string; fairness: number } | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setGive([]);
    setGet([]);
    setResult(null);
  }

  const userValueOfReceived = useMemo(
    () => valueOfAssetsTo(league, userTeamId, get),
    [league, userTeamId, get],
  );
  const userValueOfGiven = useMemo(
    () => valueOfAssetsTo(league, userTeamId, give),
    [league, userTeamId, give],
  );
  const partnerWillAccept = useMemo(() => {
    if (!give.length && !get.length) return null;
    return evaluateAcceptance(league, partner, give, get);
  }, [league, partner, give, get]);

  async function send() {
    setBusy(true);
    const res = propose(partner, give, get);
    setResult(res);
    if (res.accepted) {
      // Clear after success
      setGive([]);
      setGet([]);
    }
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <Panel title="Trade Partner">
        <select
          value={partner}
          onChange={(e) => { setPartner(e.target.value); reset(); }}
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm tap"
        >
          {otherTeams(userTeamId).map((id) => {
            const t = TEAMS_BY_ID[id];
            return <option key={id} value={id}>{t.city} {t.name}</option>;
          })}
        </select>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <SidePanel
          title={`${userTeam.city} ${userTeam.name} — sending`}
          team={userTeam}
          league={league}
          ownerTeamId={userTeamId}
          selected={give}
          onAdd={(a) => setGive((s) => [...s, a])}
          onRemove={(a) => setGive((s) => s.filter((x) => !sameAsset(x, a)))}
        />
        <SidePanel
          title={`${TEAMS_BY_ID[partner].city} ${TEAMS_BY_ID[partner].name} — receiving from`}
          team={TEAMS_BY_ID[partner]}
          league={league}
          ownerTeamId={partner}
          selected={get}
          onAdd={(a) => setGet((s) => [...s, a])}
          onRemove={(a) => setGet((s) => s.filter((x) => !sameAsset(x, a)))}
        />
      </div>

      <Panel title="Trade Summary">
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="You give (value)" value={Math.round(baseValueOf(league, give))} hint={`${give.length} asset${give.length === 1 ? "" : "s"}`} />
          <Stat label="You get (value)" value={Math.round(baseValueOf(league, get))} hint={`${get.length} asset${get.length === 1 ? "" : "s"}`} />
          <Stat label="To-team fairness"
            value={partnerWillAccept ? `${Math.round(partnerWillAccept.fairness * 100)}%` : "—"}
            hint={partnerWillAccept ? partnerWillAccept.reason : "Pick assets"}
          />
        </div>

        {partnerWillAccept && (
          <div className={cn(
            "mt-3 rounded-md border p-3 text-sm",
            partnerWillAccept.accept
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
              : "border-amber-500/40 bg-amber-500/10 text-amber-200",
          )}>
            {partnerWillAccept.accept
              ? <><Check size={14} className="-mt-0.5 inline" /> {TEAMS_BY_ID[partner].abbr} would accept — "{partnerWillAccept.reason}"</>
              : <><AlertTriangle size={14} className="-mt-0.5 inline" /> {TEAMS_BY_ID[partner].abbr} would reject — "{partnerWillAccept.reason}"</>
            }
          </div>
        )}

        {result && (
          <div className={cn(
            "mt-3 rounded-md border p-3 text-sm",
            result.accepted ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
              : "border-red-500/40 bg-red-500/10 text-red-300",
          )}>
            {result.accepted
              ? <><Check size={14} className="-mt-0.5 inline" /> Trade accepted! {result.reason}</>
              : <><X size={14} className="-mt-0.5 inline" /> Rejected — {result.reason}</>
            }
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={send}
            disabled={busy || !give.length || !get.length}
            className="rounded-md bg-accent px-4 py-2 text-sm font-bold text-bg tap disabled:opacity-40 hover:opacity-90"
          >
            Send Offer
          </button>
          <button
            onClick={reset}
            className="rounded-md border border-border bg-surface px-3 py-2 text-xs hover:bg-surface2 tap"
          >
            Clear
          </button>
        </div>
      </Panel>
    </div>
  );
}

function SidePanel({
  title, team, league, ownerTeamId, selected, onAdd, onRemove,
}: {
  title: string;
  team: typeof TEAMS[0];
  league: League;
  ownerTeamId: string;
  selected: TradeAsset[];
  onAdd: (a: TradeAsset) => void;
  onRemove: (a: TradeAsset) => void;
}) {
  const [tab, setTab] = useState<"players" | "picks">("players");

  const roster = useMemo(() => {
    return getRoster(league, ownerTeamId).filter((p) => !p.retired);
  }, [league, ownerTeamId]);

  const picks = useMemo(() => {
    return league.draftPicks
      .filter((dp) => dp.currentTeam === ownerTeamId && !dp.used && dp.year >= league.year)
      .sort((a, b) => a.year - b.year || a.round - b.round || a.pick - b.pick);
  }, [league, ownerTeamId]);

  return (
    <Panel title={title}>
      <div className="mb-2 flex items-center gap-2">
        <TeamLogo team={team} size={20} />
        <div className="flex-1 truncate text-xs text-muted">
          {selected.length === 0 ? "Tap a player or pick to add" : `${selected.length} selected`}
        </div>
      </div>

      <div className="mb-2 flex gap-1">
        <TabBtn active={tab === "players"} onClick={() => setTab("players")}>Players</TabBtn>
        <TabBtn active={tab === "picks"} onClick={() => setTab("picks")}>Picks ({picks.length})</TabBtn>
      </div>

      <div className="scrollbar-thin max-h-[420px] overflow-y-auto rounded-md border border-border bg-bg">
        {tab === "players" && (
          <ul className="divide-y divide-border/60">
            {roster.map((p) => {
              const a: TradeAsset = { kind: "player", playerId: p.id };
              const sel = selected.some((x) => sameAsset(x, a));
              const v = playerTradeValue(p);
              return (
                <li key={p.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-surface2/40">
                  <span className="grid h-7 w-9 shrink-0 place-items-center rounded bg-surface2 font-mono text-[10px] text-muted">{p.position}</span>
                  <Link href={`/player/${p.id}`} className="flex-1 truncate text-xs hover:text-accent">
                    {p.firstName[0]}. {p.lastName}
                    <span className="ml-1 text-muted">#{p.jersey}</span>
                  </Link>
                  <span className={cn("font-mono text-xs", gradeColor(p.ovr))}>{p.ovr}</span>
                  <span className="hidden text-[10px] text-muted sm:inline w-12 text-right">val {v}</span>
                  <button
                    onClick={() => sel ? onRemove(a) : onAdd(a)}
                    className={cn(
                      "grid h-7 w-7 place-items-center rounded-md tap",
                      sel ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                          : "border border-border text-muted hover:bg-surface2",
                    )}
                  >
                    {sel ? <X size={12} /> : <Plus size={12} />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {tab === "picks" && (
          <ul className="divide-y divide-border/60">
            {picks.map((dp) => {
              const a: TradeAsset = { kind: "pick", pickKey: pickKeyOf(dp) };
              const sel = selected.some((x) => sameAsset(x, a));
              const v = pickTradeValue(dp.year, dp.round, dp.pick, league.year);
              return (
                <li key={pickKeyOf(dp)} className="flex items-center gap-2 px-2 py-1.5 hover:bg-surface2/40">
                  <span className="rounded bg-accent/15 px-1.5 py-0.5 font-mono text-[10px] text-accent">
                    {dp.year} R{dp.round} P{dp.pick}
                  </span>
                  <span className="flex-1 truncate text-xs text-muted">
                    {dp.originalTeam !== ownerTeamId && <span>via {dp.originalTeam}</span>}
                  </span>
                  <span className="text-[10px] text-muted">val {v}</span>
                  <button
                    onClick={() => sel ? onRemove(a) : onAdd(a)}
                    className={cn(
                      "grid h-7 w-7 place-items-center rounded-md tap",
                      sel ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                          : "border border-border text-muted hover:bg-surface2",
                    )}
                  >
                    {sel ? <X size={12} /> : <Plus size={12} />}
                  </button>
                </li>
              );
            })}
            {!picks.length && <li className="p-3 text-center text-xs text-muted">No tradeable picks</li>}
          </ul>
        )}
      </div>
    </Panel>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={cn("rounded-md px-2 py-1 text-xs tap",
        active ? "bg-accent/15 text-accent" : "text-muted hover:text-fg")}>
      {children}
    </button>
  );
}

function otherTeams(userId: string) {
  return TEAMS.map((t) => t.id).filter((id) => id !== userId);
}

function sameAsset(a: TradeAsset, b: TradeAsset) {
  if (a.kind !== b.kind) return false;
  if (a.kind === "player") return a.playerId === b.playerId;
  return a.pickKey === b.pickKey;
}
