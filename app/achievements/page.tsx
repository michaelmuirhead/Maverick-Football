"use client";
import Link from "next/link";
import { useLeague } from "@/lib/store/league";
import { Empty, Panel, Section } from "@/components/panels";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { TeamLogo } from "@/components/team-logo";
import { Trophy, Star, Calendar, ListTree, Users } from "lucide-react";
import type { Achievement } from "@/lib/types";

export default function AchievementsPage() {
  const league = useLeague((s) => s.league);
  if (!league) return <Empty>No league yet.</Empty>;
  const achievements = (league.achievements ?? []).slice().sort((a, b) => b.unlockedYear - a.unlockedYear);

  const byCategory: Record<Achievement["category"], Achievement[]> = {
    Championship: [], Season: [], Career: [], Streak: [], Roster: [],
  };
  for (const a of achievements) byCategory[a.category].push(a);

  return (
    <div className="space-y-4">
      <header className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center gap-3">
          <Trophy size={24} className="text-accent" />
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold">Achievements</h1>
            <p className="text-xs text-muted">{achievements.length} unlocked across this dynasty</p>
          </div>
        </div>
      </header>

      {achievements.length === 0 ? (
        <Empty>No achievements yet. Win, draft, and build — they'll come.</Empty>
      ) : (
        <Section title="Unlocked">
          {(Object.entries(byCategory) as [Achievement["category"], Achievement[]][]).map(([cat, list]) =>
            list.length > 0 && (
              <Panel key={cat} title={cat}>
                <ul className="space-y-1.5">
                  {list.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 rounded-md border border-accent/30 bg-accent/5 px-3 py-2">
                      <Star size={16} className="shrink-0 text-accent" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{a.title}</div>
                        {a.detail && <div className="text-[11px] text-muted">{a.detail}</div>}
                      </div>
                      <div className="text-[11px] text-muted">{a.unlockedYear}</div>
                      {a.teamId && <TeamLogo team={TEAMS_BY_ID[a.teamId]} size={20} />}
                    </li>
                  ))}
                </ul>
              </Panel>
            ),
          )}
        </Section>
      )}

      <Link href="/" className="text-sm text-muted hover:text-fg">← Back to dashboard</Link>
    </div>
  );
}
