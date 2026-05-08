"use client";
import { use, useState } from "react";
import Link from "next/link";
import { useLeague } from "@/lib/store/league";
import { Empty, Panel, Section, Stat } from "@/components/panels";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { TeamLogo } from "@/components/team-logo";
import { gradeColor, tierBadge, cn } from "@/lib/utils";
import type { Attributes, Player, Position } from "@/lib/types";
import { POSITION_LABEL } from "@/lib/data/positions";
import { topChemistry } from "@/lib/cpu/chemistry";
import { suggestedExtensionAav } from "@/lib/cpu/contracts";
import { labelSeverity } from "@/lib/cpu/injuries";
import { ArrowDown, Scissors, FileText, RefreshCw, Activity } from "lucide-react";

const ATTR_GROUPS: Record<string, [string, keyof Attributes][]> = {
  Physical: [["Speed","spd"],["Acceleration","acc"],["Agility","agi"],["Strength","str"],["Jump","jmp"],["Stamina","sta"],["Durability","dur"]],
  Mental: [["Awareness","awr"]],
  Passing: [["Throw Power","thp"],["Throw Accuracy","tha"],["Play Action","pac"],["Tough Under Pressure","tup"]],
  Rushing: [["Carrying","car"],["Break Tackle","btk"],["Elusiveness","ela"],["Vision","vis"]],
  Receiving: [["Catching","cat"],["Release","rls"],["Route Running","rte"]],
  Blocking: [["Pass Block","pbk"],["Run Block","rbk"],["Impact Block","ibl"]],
  "Pass Rush": [["Power Moves","pmv"],["Finesse Moves","fmv"],["Block Shed","bsh"]],
  Tackling: [["Tackle","tak"],["Hit Power","hpw"]],
  Coverage: [["Man Coverage","pcv"],["Zone Coverage","zcv"],["Press","prc"]],
  Kicking: [["Kick Power","kpw"],["Kick Accuracy","kac"]],
};

export default function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const league = useLeague((s) => s.league);
  if (!league) return <Empty>No league yet.</Empty>;
  const p = league.players[id];
  if (!p) return <Empty>Player not found.</Empty>;

  const team = p.team ? TEAMS_BY_ID[p.team] : null;
  const tier = tierBadge(p.ovr);

  return (
    <div className="space-y-4">
      <header className="rounded-lg border border-border bg-surface p-4"
              style={team ? { background: `linear-gradient(135deg, ${team.primary}55, ${team.secondary}33), rgb(17 20 27)` } : undefined}>
        <div className="flex items-center gap-3">
          {team && <TeamLogo team={team} size={40} />}
          <div className="min-w-0 flex-1">
            <div className="font-display text-2xl font-bold leading-tight">
              {p.firstName} {p.lastName}{" "}
              <span className="text-base text-muted">#{p.jersey}</span>
            </div>
            <div className="text-xs text-muted">
              {POSITION_LABEL[p.position as Position]} • {feet(p.heightIn)} {p.weightLb} lb • Age {p.age} • {p.college}
              {team && <> • <Link href={`/team/${team.id}`} className="hover:text-fg">{team.city} {team.name}</Link></>}
            </div>
          </div>
          <div className="text-right">
            <div className={`font-mono text-3xl font-bold ${gradeColor(p.ovr)}`}>{p.ovr}</div>
            <div className="text-[10px] text-muted">POT {p.pot}</div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          <span className={`rounded border px-2 py-0.5 text-[10px] font-bold tracking-wide ${tier.cls}`}>{tier.label}</span>
          {p.depth && <span className="rounded border border-border bg-surface2 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">{p.depth}</span>}
          {p.injury && (
            <span className="rounded border border-red-500/40 bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-300">
              {p.injury.type.toUpperCase()} — {labelSeverity(p.injury.severity).toUpperCase()} · {p.injury.weeks}w
            </span>
          )}
          {!p.injury && p.injuryWeeks > 0 && <span className="rounded border border-red-500/40 bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-300">INJURED — {p.injuryWeeks}w</span>}
          {p.onIR && <span className="rounded border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">ON IR</span>}
          {p.onPracticeSquad && <span className="rounded border border-blue-500/40 bg-blue-500/15 px-2 py-0.5 text-[10px] font-bold text-blue-300">PRACTICE SQUAD</span>}
          {p.demandsExtension && <span className="rounded border border-orange-500/40 bg-orange-500/15 px-2 py-0.5 text-[10px] font-bold text-orange-300">DEMANDING EXTENSION</span>}
          {p.fatherId && league.players[p.fatherId] && (
            <span className="rounded border border-cyan-500/40 bg-cyan-500/15 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
              SON OF {league.players[p.fatherId].firstName.toUpperCase()} {league.players[p.fatherId].lastName.toUpperCase()}
            </span>
          )}
          {p.retiredJerseyTeam && <span className="rounded border border-fuchsia-500/40 bg-fuchsia-500/15 px-2 py-0.5 text-[10px] font-bold text-fuchsia-300">JERSEY RETIRED · {p.retiredJerseyTeam}</span>}
          {p.retired && <span className="rounded border border-zinc-500/40 bg-zinc-500/15 px-2 py-0.5 text-[10px] font-bold text-zinc-300">RETIRED</span>}
          {p.hofYear && <span className="rounded border border-fuchsia-500/40 bg-fuchsia-500/15 px-2 py-0.5 text-[10px] font-bold text-fuchsia-300">HALL OF FAME</span>}
        </div>
      </header>

      {league.userTeam === p.team && p.team && !p.retired && (
        <ContractActions player={p} />
      )}

      {(p.milestones?.length ?? 0) > 0 && (
        <Section title="Milestones">
          <ul className="space-y-1">
            {p.milestones!.slice(-8).reverse().map((m, i) => (
              <li key={i} className="rounded-md border border-accent/30 bg-accent/5 px-3 py-2 text-xs">
                <span className="text-accent">★</span> {m.text} <span className="text-muted">· {m.year}{m.week ? ` Wk${m.week}` : ""}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(() => {
        const chem = topChemistry(league, p.id);
        if (!chem.length) return null;
        return (
          <Panel title="Top Chemistry">
            <div className="grid gap-1 sm:grid-cols-3">
              {chem.map((c) => (
                <Link key={c.partnerId} href={`/player/${c.partnerId}`} className="flex items-center justify-between rounded-md border border-border bg-bg px-3 py-2 text-xs hover:bg-surface2">
                  <span className="truncate">{c.partnerName}</span>
                  <span className="font-mono text-muted">{c.games} g</span>
                </Link>
              ))}
            </div>
          </Panel>
        );
      })()}

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Hometown" value={<span className="text-sm">{p.hometown}</span>} />
        <Stat label="Drafted" value={p.draftRound ? `R${p.draftRound} P${p.draftPick}` : "UDFA"} hint={`${p.draftYear}`} />
        {p.contract ? (
          <>
            <Stat label="Contract" value={`$${p.contract.aav.toFixed(1)}M / yr`} hint={`${p.contract.years} yr remaining`} />
            <Stat label="Signing Bonus" value={`$${(p.contract.signingBonus ?? 0).toFixed(1)}M`} />
          </>
        ) : (
          <Stat label="Status" value={p.retired ? "Retired" : "Free Agent"} />
        )}
      </div>

      <Section title="Attributes">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(ATTR_GROUPS).map(([group, attrs]) => {
            const visible = attrs.filter(([, k]) => p.attributes[k] !== undefined);
            if (!visible.length) return null;
            return (
              <Panel key={group} title={group}>
                <div className="space-y-1.5">
                  {visible.map(([label, k]) => {
                    const v = p.attributes[k]!;
                    return (
                      <div key={String(k)} className="flex items-center gap-2">
                        <span className="w-32 truncate text-xs text-muted">{label}</span>
                        <div className="flex-1">
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg">
                            <div className="h-full" style={{ width: `${v}%`, background: `linear-gradient(90deg, ${barColor(v)}, ${barColor(v)})` }} />
                          </div>
                        </div>
                        <span className={`w-7 text-right font-mono text-xs tabular-nums ${gradeColor(v)}`}>{v}</span>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            );
          })}
        </div>
      </Section>

      <Section title="Career">
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-max text-xs">
            <thead className="bg-surface2 text-muted">
              <tr>
                <th className="px-2 py-1 text-left">Year</th>
                <th className="px-2 py-1 text-left">Team</th>
                <th className="px-2 py-1 text-right">GP</th>
                {careerCols(p).map((c) => <th key={c.key} className="px-2 py-1 text-right">{c.label}</th>)}
                <th className="px-2 py-1 text-right">Honors</th>
              </tr>
            </thead>
            <tbody>
              {[...p.history].sort((a,b) => a.year - b.year).map((row) => (
                <tr key={row.year} className="border-t border-border">
                  <td className="px-2 py-1">{row.year}</td>
                  <td className="px-2 py-1">{row.team}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{row.gp}</td>
                  {careerCols(p).map((c) => <td key={c.key} className="px-2 py-1 text-right tabular-nums">{(row as any)[c.key] ?? "—"}</td>)}
                  <td className="px-2 py-1 text-right text-[10px]">
                    {row.mvp && "MVP "}
                    {row.opoy && "OPOY "}
                    {row.dpoy && "DPOY "}
                    {row.oroy && "OROY "}
                    {row.droy && "DROY "}
                    {row.allPro && "AP1 "}
                    {row.proBowl && !row.allPro && "PB "}
                    {row.champion && "🏆"}
                  </td>
                </tr>
              ))}
              {p.history.length === 0 && (
                <tr><td colSpan={5} className="px-2 py-4 text-center text-muted">No games played yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function feet(inches: number) {
  const f = Math.floor(inches / 12);
  const i = inches % 12;
  return `${f}'${i}"`;
}

function barColor(v: number) {
  if (v >= 90) return "rgb(52 211 153)";
  if (v >= 80) return "rgb(74 222 128)";
  if (v >= 70) return "rgb(250 204 21)";
  if (v >= 60) return "rgb(251 146 60)";
  return "rgb(248 113 113)";
}

function ContractActions({ player }: { player: Player }) {
  const restructure = useLeague((s) => s.restructure);
  const extend = useLeague((s) => s.extend);
  const cut = useLeague((s) => s.cutPlayer);
  const toIR = useLeague((s) => s.toIR);
  const fromIR = useLeague((s) => s.fromIR);
  const toPS = useLeague((s) => s.toPracticeSquad);
  const fromPS = useLeague((s) => s.fromPracticeSquad);

  const [showExtend, setShowExtend] = useState(false);
  const [years, setYears] = useState(3);
  const [aav, setAav] = useState(suggestedExtensionAav(player));
  const [msg, setMsg] = useState<string | null>(null);

  const c = player.contract;

  return (
    <Panel title="Contract & Roster">
      {c ? (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3 text-xs">
            <div className="rounded-md border border-border bg-bg px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-muted">AAV</div>
              <div className="font-mono text-base">${c.aav.toFixed(1)}M</div>
            </div>
            <div className="rounded-md border border-border bg-bg px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-muted">Years left</div>
              <div className="font-mono text-base">{c.years}</div>
            </div>
            <div className="rounded-md border border-border bg-bg px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-muted">Bonus / Guaranteed</div>
              <div className="font-mono text-base">${(c.signingBonus ?? 0).toFixed(1)}M / {c.guaranteedYears ?? 0}y</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                const r = restructure(player.id);
                setMsg(r.ok ? `Restructured — $${r.capRelief.toFixed(1)}M cap relief` : `Failed: ${r.reason}`);
              }}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-3 py-1.5 text-xs hover:bg-surface2"
            >
              <RefreshCw size={12} /> Restructure
            </button>
            <button
              onClick={() => setShowExtend((s) => !s)}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-3 py-1.5 text-xs hover:bg-surface2"
            >
              <FileText size={12} /> Extend
            </button>
            <button
              onClick={() => {
                if (!confirm(`Cut ${player.firstName} ${player.lastName}? This may incur dead cap.`)) return;
                const r = cut(player.id, false);
                setMsg(r.ok ? "Cut — added to free agency" : `Failed: ${r.reason}`);
              }}
              className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/20"
            >
              <Scissors size={12} /> Release
            </button>
            {player.injury && !player.onIR && (
              <button onClick={() => { const r = toIR(player.id); setMsg(r.ok ? "Placed on IR" : `Failed: ${r.reason}`); }}
                className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300 hover:bg-amber-500/20">
                <Activity size={12} /> Place on IR
              </button>
            )}
            {player.onIR && (
              <button onClick={() => { const r = fromIR(player.id); setMsg(r.ok ? "Activated from IR" : `Failed: ${r.reason}`); }}
                className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/20">
                Activate from IR
              </button>
            )}
            {!player.onPracticeSquad && (
              <button onClick={() => { const r = toPS(player.id); setMsg(r.ok ? "Sent to practice squad" : `Failed: ${r.reason}`); }}
                className="inline-flex items-center gap-1 rounded-md border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-xs text-blue-300 hover:bg-blue-500/20">
                <ArrowDown size={12} /> Send to PS
              </button>
            )}
            {player.onPracticeSquad && (
              <button onClick={() => { const r = fromPS(player.id); setMsg(r.ok ? "Promoted to active roster" : `Failed: ${r.reason}`); }}
                className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/20">
                Promote from PS
              </button>
            )}
          </div>

          {showExtend && (
            <div className="rounded-md border border-border bg-bg p-3 text-xs">
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted">Add years</span>
                  <input type="number" min={1} max={6} value={years} onChange={(e) => setYears(parseInt(e.target.value) || 1)}
                    className="rounded border border-border bg-bg px-2 py-1 text-sm" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted">New AAV ($M)</span>
                  <input type="number" step={0.5} value={aav} onChange={(e) => setAav(parseFloat(e.target.value) || 0)}
                    className="rounded border border-border bg-bg px-2 py-1 text-sm" />
                </label>
                <button
                  onClick={() => {
                    const r = extend(player.id, years, aav);
                    setMsg(r.ok ? "Extended" : `Failed: ${r.reason}`);
                    if (r.ok) setShowExtend(false);
                  }}
                  className="self-end rounded-md bg-accent px-3 py-1.5 text-xs font-bold text-bg"
                >
                  Apply Extension
                </button>
              </div>
            </div>
          )}

          {msg && <div className="text-xs text-muted">{msg}</div>}
        </div>
      ) : (
        <Empty>No active contract.</Empty>
      )}
    </Panel>
  );
}

function careerCols(p: Player) {
  const grp = p.position;
  if (grp === "QB") return [
    { key: "passYds", label: "PYd" },
    { key: "passTd", label: "PTD" },
    { key: "passInt", label: "INT" },
    { key: "rushYds", label: "RYd" },
    { key: "rushTd", label: "RTD" },
  ];
  if (grp === "RB" || grp === "FB") return [
    { key: "rushYds", label: "RYd" },
    { key: "rushTd", label: "RTD" },
    { key: "rec", label: "Rec" },
    { key: "recYds", label: "RYd" },
    { key: "recTd", label: "RTD" },
  ];
  if (grp === "WR" || grp === "TE") return [
    { key: "rec", label: "Rec" },
    { key: "recYds", label: "RYd" },
    { key: "recTd", label: "TD" },
    { key: "tgt", label: "Tgt" },
  ];
  if (grp === "K" || grp === "P") return [
    { key: "fgm", label: "FGM" },
    { key: "fga", label: "FGA" },
    { key: "xpm", label: "XPM" },
    { key: "xpa", label: "XPA" },
  ];
  // Defense
  return [
    { key: "tackles", label: "Tkl" },
    { key: "sacks", label: "Sck" },
    { key: "ints", label: "INT" },
    { key: "ffum", label: "FF" },
  ];
}
