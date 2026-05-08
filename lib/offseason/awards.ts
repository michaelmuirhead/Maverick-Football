import type { League, Award, Player } from "@/lib/types";

function passerRating(att: number, cmp: number, yds: number, td: number, intc: number) {
  if (att === 0) return 0;
  const a = ((cmp / att) - 0.3) * 5;
  const b = ((yds / att) - 3) * 0.25;
  const c = (td / att) * 20;
  const d = 2.375 - ((intc / att) * 25);
  const sum = (Math.min(Math.max(a, 0), 2.375) +
               Math.min(Math.max(b, 0), 2.375) +
               Math.min(Math.max(c, 0), 2.375) +
               Math.min(Math.max(d, 0), 2.375)) / 6;
  return Math.round(sum * 100 * 10) / 10;
}

function statRow(p: Player, year: number) {
  return p.history.find((h) => h.year === year);
}

export function pickAwards(league: League): Award[] {
  const yr = league.year;
  const players = Object.values(league.players).filter((p) => statRow(p, yr));

  const awards: Award[] = [];

  // Offensive scoring metric
  const offScore = (p: Player) => {
    const r = statRow(p, yr); if (!r) return 0;
    return (r.passYds ?? 0) * 0.04 + (r.passTd ?? 0) * 4 + (r.passInt ?? 0) * -2 +
           (r.rushYds ?? 0) * 0.06 + (r.rushTd ?? 0) * 6 +
           (r.recYds ?? 0) * 0.06 + (r.recTd ?? 0) * 6 +
           (r.gp ?? 0) * 0.5;
  };
  const defScore = (p: Player) => {
    const r = statRow(p, yr); if (!r) return 0;
    return (r.tackles ?? 0) * 1 + (r.sacks ?? 0) * 4 + (r.ints ?? 0) * 5 + (r.ffum ?? 0) * 3 + (r.gp ?? 0) * 0.4;
  };

  // MVP — best overall offensive contributor (heavily QB/RB-skewed)
  const mvp = [...players].sort((a, b) => offScore(b) - offScore(a))[0];
  if (mvp) {
    awards.push({ year: yr, type: "MVP", playerId: mvp.id, team: mvp.team!, position: mvp.position });
    const r = statRow(mvp, yr); if (r) r.mvp = true;
    league.news.unshift({
      id: `mvp${yr}`, year: yr, week: 0, ts: Date.now(), category: "Award",
      headline: `${mvp.firstName} ${mvp.lastName} (${mvp.position}) named ${yr} MVP`,
      playerId: mvp.id, teamId: mvp.team!,
    });
  }

  // OPOY — best non-MVP offensive
  const opoy = [...players].filter((p) => p.id !== mvp?.id && ["RB","WR","TE","QB"].includes(p.position)).sort((a, b) => offScore(b) - offScore(a))[0];
  if (opoy) {
    awards.push({ year: yr, type: "OPOY", playerId: opoy.id, team: opoy.team!, position: opoy.position });
    const r = statRow(opoy, yr); if (r) r.opoy = true;
  }

  // DPOY
  const dpoy = [...players].sort((a, b) => defScore(b) - defScore(a))[0];
  if (dpoy) {
    awards.push({ year: yr, type: "DPOY", playerId: dpoy.id, team: dpoy.team!, position: dpoy.position });
    const r = statRow(dpoy, yr); if (r) r.dpoy = true;
  }

  // OROY/DROY (rookies = age <= 23 and draftYear === yr)
  const rookies = players.filter((p) => p.draftYear === yr);
  const oroy = [...rookies].filter((p) => ["QB","RB","WR","TE"].includes(p.position)).sort((a, b) => offScore(b) - offScore(a))[0];
  if (oroy) {
    awards.push({ year: yr, type: "OROY", playerId: oroy.id, team: oroy.team!, position: oroy.position });
    const r = statRow(oroy, yr); if (r) r.oroy = true;
  }
  const droy = [...rookies].filter((p) => !["QB","RB","WR","TE","K","P"].includes(p.position)).sort((a, b) => defScore(b) - defScore(a))[0];
  if (droy) {
    awards.push({ year: yr, type: "DROY", playerId: droy.id, team: droy.team!, position: droy.position });
    const r = statRow(droy, yr); if (r) r.droy = true;
  }

  // Pro Bowl: top ~2 per position by score (24 total per side, ~50)
  const proBowlPositions: Record<string, number> = {
    QB: 4, RB: 6, WR: 8, TE: 4, LT: 3, RT: 3, LG: 3, RG: 3, C: 3,
    LE: 3, RE: 3, DT: 4, MLB: 3, OLB: 5, CB: 6, FS: 3, SS: 3, K: 2, P: 2, FB: 1,
  };
  for (const [pos, count] of Object.entries(proBowlPositions)) {
    const isOff = ["QB","RB","FB","WR","TE","LT","RT","LG","RG","C"].includes(pos);
    const score = isOff ? offScore : defScore;
    const list = players.filter((p) => p.position === pos).sort((a, b) => score(b) - score(a)).slice(0, count);
    for (const p of list) {
      awards.push({ year: yr, type: "ProBowl", playerId: p.id, team: p.team!, position: p.position });
      const r = statRow(p, yr); if (r) r.proBowl = true;
    }
    // First-team All-Pro: top 1
    if (list[0]) {
      awards.push({ year: yr, type: "AllPro1", playerId: list[0].id, team: list[0].team!, position: list[0].position });
      const r = statRow(list[0], yr); if (r) r.allPro = true;
    }
  }

  // Champion flag
  const champ = league.champions.find((c) => c.year === yr);
  if (champ) {
    for (const p of Object.values(league.players)) {
      if (p.team === champ.team) {
        const r = statRow(p, yr); if (r) r.champion = true;
      }
    }
  }

  return awards;
}
