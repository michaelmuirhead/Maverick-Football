"use client";
import { useLeague } from "@/lib/store/league";
import { Empty, Section } from "@/components/panels";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { TeamLogo } from "@/components/team-logo";

export default function NewsPage() {
  const league = useLeague((s) => s.league);
  if (!league) return <Empty>No league yet.</Empty>;

  const news = league.news.slice(0, 100);
  return (
    <div className="space-y-4">
      <Section title="News & Headlines">
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
        </ul>
      </Section>
    </div>
  );
}
