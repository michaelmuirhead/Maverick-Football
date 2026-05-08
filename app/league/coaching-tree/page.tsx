"use client";
import Link from "next/link";
import { useLeague } from "@/lib/store/league";
import { LeagueNav } from "@/components/league-nav";
import { Empty, Panel, Section } from "@/components/panels";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { TeamLogo } from "@/components/team-logo";
import type { Coach } from "@/lib/types";
import { buildTree, type TreeNode } from "@/lib/cpu/coachTrees";

export default function CoachingTreePage() {
  const league = useLeague((s) => s.league);
  if (!league) return <Empty>No league yet.</Empty>;

  // Roots: HCs that aren't anyone's protege (or are clearly mentors)
  const allCoaches = Object.values(league.coaches).filter((c) => c.role === "HC" || c.history.some((h) => h.role === "HC"));
  const proteinIds = new Set(league.mentorships.map((m) => m.proteinId));
  const roots = allCoaches.filter((c) => !proteinIds.has(c.id));

  // Build trees and only show ones with at least one protege (otherwise it's noise)
  const trees = roots
    .map((c) => buildTree(league, c.id))
    .filter((t): t is TreeNode => !!t && t.children.length > 0);

  return (
    <div className="space-y-4">
      <LeagueNav />
      <Section title="Coaching Trees">
        {trees.length === 0 ? (
          <Empty>No mentorships logged yet — keep simming, the carousel will fill this in.</Empty>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {trees.map((t) => (
              <Panel key={t.coach.id} title={`${t.coach.firstName} ${t.coach.lastName} tree`}>
                <Tree node={t} />
              </Panel>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Tree({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  return (
    <div className="space-y-1">
      <CoachLine coach={node.coach} depth={depth} />
      {node.children.length > 0 && (
        <ul className="ml-4 border-l border-border pl-3">
          {node.children.map((c) => (
            <li key={c.coach.id} className="mt-1">
              <Tree node={c} depth={depth + 1} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CoachLine({ coach, depth }: { coach: Coach; depth: number }) {
  const team = coach.team ? TEAMS_BY_ID[coach.team] : null;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`grid h-6 w-6 place-items-center rounded ${depth === 0 ? "bg-fuchsia-500/20 text-fuchsia-300" : "bg-surface2 text-muted"} text-[9px] font-bold`}>
        {coach.role}
      </span>
      <span className="font-medium">{coach.firstName} {coach.lastName}</span>
      {coach.championships > 0 && <span className="text-fuchsia-300">★ {coach.championships}</span>}
      {coach.cotyAwards > 0 && <span className="text-emerald-400">COY×{coach.cotyAwards}</span>}
      {team && (
        <Link href={`/team/${team.id}`} className="ml-auto flex items-center gap-1 text-muted hover:text-accent">
          <TeamLogo team={team} size={14} />
          <span>{team.abbr}</span>
        </Link>
      )}
    </div>
  );
}
