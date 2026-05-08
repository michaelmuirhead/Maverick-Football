"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { League, TradeAsset, TradeOffer } from "@/lib/types";
import { TEAMS, TEAMS_BY_ID } from "@/lib/data/teams";
import { TeamLogo } from "./team-logo";
import { Panel, Stat } from "./panels";
import { useLeague } from "@/lib/store/league";
import { getRoster } from "@/lib/gen/roster";
import { cn, gradeColor } from "@/lib/utils";
import {
  baseValueOf, valueOfAssetsTo, pickKeyOf, playerTradeValue, pickTradeValue,
} from "@/lib/cpu/tradeValue";
import { evaluateAcceptance } from "@/lib/cpu/tradeAI";
import { executeTrade, validateAssets, validateCap, newTradeId } from "@/lib/cpu/tradeExecute";
import { userCan } from "@/lib/cpu/career";
import { Plus, X, Check, AlertTriangle, ArrowRight } from "lucide-react";

// =====================================================================
// Multi-team trade scenario tester. Up to 3 teams. Each asset is routed
// to a specific destination team. Each non-user team must accept.
// =====================================================================

interface RoutedAsset {
  asset: TradeAsset;
  fromTeam: string;
  toTeam: string;
}

export function MultiTeamTrade({ league }: { league: League }) {
  const userTeamId = league.userTeam!;
  const canTrade = userCan(league, "trades");
  const [partners, setPartners] = useState<string[]>(() => {
    const others = TEAMS.filter((t) => t.id !== userTeamId).slice(0, 1);
    return [others[0].id];
  });
  const [routed, setRouted] = useState<RoutedAsset[]>([]);
  const [result, setResult] = useState<{ accepted: boolean; reason: string } | null>(null);

  const teams = useMemo(() => [userTeamId, ...partners], [userTeamId, partners]);

  function addPartner() {
    if (partners.length >= 2) return;
    const next = TEAMS.find((t) => !teams.includes(t.id));
    if (next) setPartners([...partners, next.id]);
  }
  function removePartner(id: string) {
    setPartners(partners.filter((p) => p !== id));
    setRouted(routed.filter((a) => a.fromTeam !== id && a.toTeam !== id));
  }
  function changePartner(idx: number, newId: string) {
    if (teams.includes(newId)) return;
    const old = partners[idx];
    const next = [...partners];
    next[idx] = newId;
    setPartners(next);
    setRouted(routed.map((a) => ({
      ...a,
      fromTeam: a.fromTeam === old ? newId : a.fromTeam,
      toTeam: a.toTeam === old ? newId : a.toTeam,
    })));
  }
  function addAsset(asset: TradeAsset, fromTeam: string, toTeam: string) {
    if (sameRouted(routed, { asset, fromTeam, toTeam })) {
      setRouted(routed.filter((a) => !sameRouted([a], { asset, fromTeam, toTeam })));
    } else {
      setRouted([...routed, { asset, fromTeam, toTeam }]);
    }
  }

  // Compute net per team from this user's POV: what each team gives + receives
  const summaries = teams.map((teamId) => {
    const giving = routed.filter((a) => a.fromTeam === teamId).map((a) => a.asset);
    const receiving = routed.filter((a) => a.toTeam === teamId).map((a) => a.asset);
    const giveVal = baseValueOf(league, giving);
    const getVal = baseValueOf(league, receiving);
    let acceptable: { ok: boolean; reason: string } | null = null;
    if (teamId !== userTeamId && (giving.length || receiving.length)) {
      const ev = evaluateAcceptance(league, teamId, giving, receiving);
      acceptable = { ok: ev.accept, reason: ev.reason };
    }
    return { teamId, giving, receiving, giveVal, getVal, acceptable };
  });

  // Cap validation per team: simulate AAV swap
  const capProblems: string[] = [];
  for (const s of summaries) {
    const team = TEAMS_BY_ID[s.teamId];
    let leaving = 0, arriving = 0;
    for (const a of s.giving) {
      if (a.kind === "player" && a.playerId) {
        const p = league.players[a.playerId];
        if (p?.contract) leaving += p.contract.aav;
      }
    }
    for (const a of s.receiving) {
      if (a.kind === "player" && a.playerId) {
        const p = league.players[a.playerId];
        if (p?.contract) arriving += p.contract.aav;
      }
    }
    const after = currentTeamPayrollSafe(league, s.teamId) - leaving + arriving;
    if (after > team.cap + 0.5) {
      capProblems.push(`${team.abbr} would be $${(after - team.cap).toFixed(1)}M over the cap`);
    }
  }

  const allTeamsAccept = summaries.every((s) => !s.acceptable || s.acceptable.ok);
  const canExecute = canTrade && routed.length >= 2 && capProblems.length === 0 && allTeamsAccept;

  function execute() {
    if (!canExecute) return;
    // Decompose into pairwise legs and execute each as a 2-team offer
    // For the user's perspective: from userTeamId
    const partnerIds = partners;
    let allOk = true;
    let lastReason = "";
    for (const pid of partnerIds) {
      const fromUser = routed.filter((a) => a.fromTeam === userTeamId && a.toTeam === pid).map((a) => a.asset);
      const toUser = routed.filter((a) => a.toTeam === userTeamId && a.fromTeam === pid).map((a) => a.asset);
      if (fromUser.length === 0 && toUser.length === 0) continue;
      const offer: TradeOffer = {
        id: newTradeId(),
        fromTeam: userTeamId,
        toTeam: pid,
        fromAssets: fromUser,
        toAssets: toUser,
        status: "pending",
        year: league.year,
        week: league.phase === "RegularSeason" ? league.week : 0,
        ts: Date.now(),
        byUser: true,
      };
      const v1 = validateAssets(league, userTeamId, fromUser);
      const v2 = validateAssets(league, pid, toUser);
      const v3 = validateCap(league, offer);
      if (!v1.ok || !v2.ok || !v3.ok) {
        allOk = false;
        lastReason = v1.reason ?? v2.reason ?? v3.reason ?? "Validation failed";
        break;
      }
      executeTrade(league, offer);
    }
    // Then partner-to-partner legs (e.g., team B sends asset to team C)
    for (let i = 0; i < partnerIds.length; i++) {
      for (let j = 0; j < partnerIds.length; j++) {
        if (i === j) continue;
        const a = partnerIds[i], b = partnerIds[j];
        const fromA = routed.filter((r) => r.fromTeam === a && r.toTeam === b).map((r) => r.asset);
        if (!fromA.length) continue;
        const offer: TradeOffer = {
          id: newTradeId(),
          fromTeam: a,
          toTeam: b,
          fromAssets: fromA,
          toAssets: [],
          status: "pending",
          year: league.year,
          week: league.phase === "RegularSeason" ? league.week : 0,
          ts: Date.now(),
          byUser: true,
        };
        executeTrade(league, offer);
      }
    }
    if (allOk) {
      setResult({ accepted: true, reason: "Trade executed" });
      setRouted([]);
    } else {
      setResult({ accepted: false, reason: lastReason });
    }
  }

  return (
    <div className="space-y-3">
      {!canTrade && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
          Your General Manager handles trades. Build hypothetical scenarios here, but you can't send them.
        </div>
      )}

      {/* Team selector row */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">Teams in trade:</span>
        <span className="inline-flex items-center gap-1 rounded-md border border-accent bg-accent/10 px-2 py-1 text-xs text-accent">
          <TeamLogo team={TEAMS_BY_ID[userTeamId]} size={16} /> {TEAMS_BY_ID[userTeamId].abbr} (you)
        </span>
        {partners.map((pid, i) => (
          <span key={pid} className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs">
            <TeamLogo team={TEAMS_BY_ID[pid]} size={16} />
            <select value={pid} onChange={(e) => changePartner(i, e.target.value)}
              className="bg-transparent text-xs focus:outline-none">
              {TEAMS.filter((t) => t.id === pid || !teams.includes(t.id)).map((t) => (
                <option key={t.id} value={t.id}>{t.abbr}</option>
              ))}
            </select>
            <button onClick={() => removePartner(pid)} className="rounded p-0.5 text-muted hover:text-red-300">
              <X size={12} />
            </button>
          </span>
        ))}
        {partners.length < 2 && (
          <button onClick={addPartner} className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1 text-xs text-muted hover:bg-surface">
            <Plus size={12} /> Add 3rd team
          </button>
        )}
      </div>

      {/* Per-team panels */}
      <div className={cn("grid gap-2", teams.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3")}>
        {teams.map((teamId) => (
          <TeamLane
            key={teamId}
            league={league}
            teamId={teamId}
            destOptions={teams.filter((t) => t !== teamId)}
            routed={routed}
            onToggle={(asset, fromTeam, toTeam) => addAsset(asset, fromTeam, toTeam)}
          />
        ))}
      </div>

      {/* Summary */}
      <Panel title="Scenario summary">
        <div className={cn("grid gap-2", teams.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
          {summaries.map((s) => {
            const t = TEAMS_BY_ID[s.teamId];
            const isUser = s.teamId === userTeamId;
            return (
              <div key={s.teamId} className="rounded-md border border-border bg-bg p-3 text-xs">
                <div className="flex items-center gap-2">
                  <TeamLogo team={t} size={20} />
                  <span className="font-medium">{t.abbr} {isUser && "(you)"}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <div className="text-[10px] uppercase text-muted">Gives</div>
                    <div className="font-mono">{Math.round(s.giveVal)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted">Gets</div>
                    <div className="font-mono">{Math.round(s.getVal)}</div>
                  </div>
                </div>
                {s.acceptable && (
                  <div className={cn(
                    "mt-2 rounded px-2 py-1 text-[10px]",
                    s.acceptable.ok ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300",
                  )}>
                    {s.acceptable.ok ? <Check size={10} className="inline -mt-0.5" /> : <AlertTriangle size={10} className="inline -mt-0.5" />} {s.acceptable.reason}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {capProblems.length > 0 && (
          <div className="mt-2 rounded-md border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300">
            {capProblems.map((p, i) => <div key={i}>⚠ {p}</div>)}
          </div>
        )}

        {result && (
          <div className={cn(
            "mt-2 rounded-md border p-3 text-sm",
            result.accepted ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
              : "border-red-500/40 bg-red-500/10 text-red-200",
          )}>
            {result.accepted ? <><Check size={14} className="-mt-0.5 inline" /> {result.reason}</>
              : <><X size={14} className="-mt-0.5 inline" /> {result.reason}</>}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={execute}
            disabled={!canExecute}
            className="rounded-md bg-accent px-4 py-2 text-sm font-bold text-bg tap disabled:opacity-40 hover:opacity-90"
          >
            {canTrade ? "Execute trade" : "Trades restricted"}
          </button>
          <button
            onClick={() => { setRouted([]); setResult(null); }}
            className="rounded-md border border-border bg-surface px-3 py-2 text-xs hover:bg-surface2"
          >
            Clear
          </button>
        </div>
      </Panel>
    </div>
  );
}

function TeamLane({
  league, teamId, destOptions, routed, onToggle,
}: {
  league: League; teamId: string;
  destOptions: string[];
  routed: RoutedAsset[];
  onToggle: (a: TradeAsset, from: string, to: string) => void;
}) {
  const [tab, setTab] = useState<"players" | "picks">("players");
  const [defaultDest, setDefaultDest] = useState<string>(destOptions[0]);
  const team = TEAMS_BY_ID[teamId];
  const roster = useMemo(() => getRoster(league, teamId).filter((p) => !p.retired), [league, teamId]);
  const picks = useMemo(() =>
    league.draftPicks
      .filter((dp) => dp.currentTeam === teamId && !dp.used && dp.year >= league.year)
      .sort((a, b) => a.year - b.year || a.round - b.round || a.pick - b.pick),
    [league, teamId],
  );

  function isSelected(asset: TradeAsset) {
    return routed.some((r) => r.fromTeam === teamId && sameAsset(r.asset, asset));
  }

  return (
    <Panel title={`${team.abbr} sends → `}>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-muted">Default destination:</span>
        <select value={defaultDest} onChange={(e) => setDefaultDest(e.target.value)}
          className="rounded-md border border-border bg-bg px-2 py-1 text-xs">
          {destOptions.map((id) => <option key={id} value={id}>{TEAMS_BY_ID[id].abbr}</option>)}
        </select>
      </div>

      <div className="mb-2 flex gap-1">
        <TabBtn active={tab === "players"} onClick={() => setTab("players")}>Players</TabBtn>
        <TabBtn active={tab === "picks"} onClick={() => setTab("picks")}>Picks ({picks.length})</TabBtn>
      </div>

      <div className="scrollbar-thin max-h-[320px] overflow-y-auto rounded-md border border-border bg-bg">
        {tab === "players" ? (
          <ul className="divide-y divide-border/60">
            {roster.map((p) => {
              const a: TradeAsset = { kind: "player", playerId: p.id };
              const sel = isSelected(a);
              const v = playerTradeValue(p);
              return (
                <li key={p.id} className="flex items-center gap-2 px-2 py-1">
                  <span className="grid h-6 w-9 shrink-0 place-items-center rounded bg-surface2 font-mono text-[10px] text-muted">{p.position}</span>
                  <span className="flex-1 truncate text-xs">{p.firstName[0]}. {p.lastName}</span>
                  <span className={cn("font-mono text-xs", gradeColor(p.ovr))}>{p.ovr}</span>
                  <span className="hidden text-[10px] text-muted sm:inline w-10 text-right">{v}</span>
                  <button onClick={() => onToggle(a, teamId, defaultDest)}
                    className={cn(
                      "grid h-6 w-6 place-items-center rounded-md tap",
                      sel ? "bg-emerald-500/20 text-emerald-300" : "border border-border text-muted hover:bg-surface2",
                    )}>
                    {sel ? <X size={10} /> : <Plus size={10} />}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <ul className="divide-y divide-border/60">
            {picks.map((dp) => {
              const a: TradeAsset = { kind: "pick", pickKey: pickKeyOf(dp) };
              const sel = isSelected(a);
              const v = pickTradeValue(dp.year, dp.round, dp.pick, league.year);
              return (
                <li key={pickKeyOf(dp)} className="flex items-center gap-2 px-2 py-1">
                  <span className="rounded bg-accent/15 px-1.5 py-0.5 font-mono text-[10px] text-accent">{dp.year} R{dp.round}P{dp.pick}</span>
                  <span className="flex-1" />
                  <span className="text-[10px] text-muted">val {v}</span>
                  <button onClick={() => onToggle(a, teamId, defaultDest)}
                    className={cn(
                      "grid h-6 w-6 place-items-center rounded-md tap",
                      sel ? "bg-emerald-500/20 text-emerald-300" : "border border-border text-muted hover:bg-surface2",
                    )}>
                    {sel ? <X size={10} /> : <Plus size={10} />}
                  </button>
                </li>
              );
            })}
            {!picks.length && <li className="p-3 text-center text-[10px] text-muted">No tradeable picks</li>}
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

function sameAsset(a: TradeAsset, b: TradeAsset) {
  if (a.kind !== b.kind) return false;
  if (a.kind === "player") return a.playerId === b.playerId;
  return a.pickKey === b.pickKey;
}
function sameRouted(arr: RoutedAsset[], r: RoutedAsset) {
  return arr.some((x) => x.fromTeam === r.fromTeam && x.toTeam === r.toTeam && sameAsset(x.asset, r.asset));
}

// Local helper — we don't want to make the upstream function async/safe
import { currentTeamPayroll } from "@/lib/offseason/freeAgency";
function currentTeamPayrollSafe(league: League, teamId: string): number {
  return currentTeamPayroll(league, teamId);
}
