"use client";
import { use, useState } from "react";
import Link from "next/link";
import { useLeague } from "@/lib/store/league";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { TeamLogo } from "@/components/team-logo";
import { Empty, Panel, Section } from "@/components/panels";
import {
  OFFENSE_EMPHASIS_OPTIONS, DEFENSE_EMPHASIS_OPTIONS, TEMPO_OPTIONS, getGamePlan,
} from "@/lib/cpu/gamePlan";
import { staffOf } from "@/lib/cpu/coaches";
import { getRoster } from "@/lib/gen/roster";
import { gradeColor, cn } from "@/lib/utils";
import type { OffenseEmphasis, DefenseEmphasis, TempoChoice } from "@/lib/types";
import { Check, ChevronRight, Tv, Save } from "lucide-react";

export default function GamePlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const league = useLeague((s) => s.league);
  const setPlan = useLeague((s) => s.setGamePlanForGame);

  if (!league) return <Empty>No league yet.</Empty>;
  if (!league.userTeam) return <Empty>No user team.</Empty>;

  const game = league.schedule.find((g) => g.id === id);
  if (!game) return <Empty>Game not found.</Empty>;
  const userTeamId = league.userTeam;
  const userIsHome = game.home === userTeamId;
  const userTeam = TEAMS_BY_ID[userTeamId];
  const opponentTeam = TEAMS_BY_ID[userIsHome ? game.away : game.home];
  const existing = getGamePlan(league, game.id, userTeamId);

  const [offEmphasis, setOff] = useState<OffenseEmphasis>(existing?.offEmphasis ?? "Balanced");
  const [defEmphasis, setDef] = useState<DefenseEmphasis>(existing?.defEmphasis ?? "Balanced");
  const [tempo, setTempo] = useState<TempoChoice>(existing?.tempo ?? "Balanced");
  const [featured, setFeatured] = useState<string | undefined>(existing?.featuredPlayer);
  const [shadow, setShadow] = useState<string | undefined>(existing?.shadowPlayer);
  const [saved, setSaved] = useState(false);

  const myRoster = getRoster(league, userTeamId).filter((p) => p.depth !== "Reserve");
  const oppRoster = getRoster(league, opponentTeam.id).filter((p) => p.depth === "Starter" && (p.position === "WR" || p.position === "TE" || p.position === "RB" || p.position === "QB"));
  const oppKeyPlayers = oppRoster.sort((a, b) => b.ovr - a.ovr).slice(0, 6);

  const featuredCandidates = myRoster.filter((p) => ["WR","RB","TE"].includes(p.position) && p.depth !== "Reserve").sort((a, b) => b.ovr - a.ovr).slice(0, 8);

  const { hc, oc, dc } = staffOf(league, userTeamId);

  function save() {
    setPlan(game!.id, { offEmphasis, defEmphasis, tempo, featuredPlayer: featured, shadowPlayer: shadow });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-4">
      <header className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center gap-3">
          <TeamLogo team={userTeam} size={40} />
          <div className="text-xl">vs</div>
          <TeamLogo team={opponentTeam} size={40} />
          <div className="flex-1 min-w-0">
            <div className="font-display text-lg font-bold">Game Plan — Week {game.week} {existing?.byUser ? "(saved)" : ""}</div>
            <div className="text-xs text-muted">{userTeam.city} {userTeam.name} {userIsHome ? "vs" : "@"} {opponentTeam.city} {opponentTeam.name}</div>
          </div>
          <Link href={`/game/${game.id}/live`} className="hidden items-center gap-1 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-bold text-accent tap hover:bg-accent/20 sm:flex">
            <Tv size={12} /> Watch live
          </Link>
        </div>
        {(hc || oc || dc) && (
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {hc && <CoachChip label="HC" name={`${hc.firstName} ${hc.lastName}`} />}
            {oc && <CoachChip label="OC" name={`${oc.firstName} ${oc.lastName}`} extra={oc.offenseScheme} />}
            {dc && <CoachChip label="DC" name={`${dc.firstName} ${dc.lastName}`} extra={dc.defenseScheme} />}
          </div>
        )}
      </header>

      <Section title="Offensive emphasis">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {OFFENSE_EMPHASIS_OPTIONS.map((opt) => (
            <Choice key={opt.id} active={offEmphasis === opt.id} onClick={() => setOff(opt.id)}>
              <div className="font-medium">{opt.label}</div>
              <div className="text-[11px] text-muted">{opt.desc}</div>
            </Choice>
          ))}
        </div>
      </Section>

      <Section title="Defensive emphasis">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {DEFENSE_EMPHASIS_OPTIONS.map((opt) => (
            <Choice key={opt.id} active={defEmphasis === opt.id} onClick={() => setDef(opt.id)}>
              <div className="font-medium">{opt.label}</div>
              <div className="text-[11px] text-muted">{opt.desc}</div>
            </Choice>
          ))}
        </div>
      </Section>

      <Section title="Tempo">
        <div className="grid gap-2 sm:grid-cols-3">
          {TEMPO_OPTIONS.map((opt) => (
            <Choice key={opt.id} active={tempo === opt.id} onClick={() => setTempo(opt.id)}>
              <div className="font-medium">{opt.label}</div>
              <div className="text-[11px] text-muted">{opt.desc}</div>
            </Choice>
          ))}
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Feature on offense (optional)">
          <p className="mb-2 text-xs text-muted">Boost target/touch share for this player.</p>
          <div className="grid gap-1">
            <PickRow active={featured === undefined} onClick={() => setFeatured(undefined)}>
              <span className="text-muted">— None —</span>
            </PickRow>
            {featuredCandidates.map((p) => (
              <PickRow key={p.id} active={featured === p.id} onClick={() => setFeatured(p.id)}>
                <span className="rounded bg-surface2 px-1.5 py-0.5 font-mono text-[10px]">{p.position}</span>
                <span className="flex-1 truncate">{p.firstName} {p.lastName}</span>
                <span className={`font-mono text-xs ${gradeColor(p.ovr)}`}>{p.ovr}</span>
              </PickRow>
            ))}
          </div>
        </Panel>

        <Panel title="Shadow opponent (optional)">
          <p className="mb-2 text-xs text-muted">Double-cover this opposing player to limit their touches.</p>
          <div className="grid gap-1">
            <PickRow active={shadow === undefined} onClick={() => setShadow(undefined)}>
              <span className="text-muted">— None —</span>
            </PickRow>
            {oppKeyPlayers.map((p) => (
              <PickRow key={p.id} active={shadow === p.id} onClick={() => setShadow(p.id)}>
                <span className="rounded bg-surface2 px-1.5 py-0.5 font-mono text-[10px]">{p.position}</span>
                <span className="flex-1 truncate">{p.firstName} {p.lastName}</span>
                <span className={`font-mono text-xs ${gradeColor(p.ovr)}`}>{p.ovr}</span>
              </PickRow>
            ))}
          </div>
        </Panel>
      </div>

      <div className="sticky bottom-20 z-20 flex justify-end sm:bottom-4">
        <button
          onClick={save}
          className={cn(
            "inline-flex items-center gap-2 rounded-md px-5 py-3 text-sm font-bold shadow-lg tap",
            saved ? "bg-emerald-500 text-bg" : "bg-accent text-bg hover:opacity-90",
          )}
        >
          {saved ? <Check size={16} /> : <Save size={16} />}
          {saved ? "Saved" : "Save game plan"}
        </button>
      </div>

      <div className="flex justify-end">
        <Link href={`/game/${game.id}/live`} className="inline-flex items-center gap-1 rounded-md bg-surface2 px-3 py-2 text-xs font-bold tap hover:bg-surface">
          Continue to live game <ChevronRight size={12} />
        </Link>
      </div>
    </div>
  );
}

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg border p-3 text-left tap",
        active ? "border-accent bg-accent/10" : "border-border bg-surface hover:bg-surface2",
      )}
    >
      {children}
    </button>
  );
}

function PickRow({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-xs tap",
        active ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface hover:bg-surface2",
      )}
    >
      {children}
    </button>
  );
}

function CoachChip({ label, name, extra }: { label: string; name: string; extra?: string }) {
  return (
    <div className="rounded-md border border-border bg-bg px-3 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="text-sm font-medium">{name}</div>
      {extra && <div className="text-[10px] text-muted">{extra}</div>}
    </div>
  );
}
