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

  // Comeback Player of the Year — biggest OVR rebound after a major injury or down year
  const cbpoy = [...players].filter((p) => {
    // Player who had season-ending injury LAST year (legacy injuryWeeks signal)
    const lastSeason = p.history.find((h) => h.year === yr - 1);
    const hadDownYear = lastSeason && (lastSeason.gp ?? 0) <= 8;
    return hadDownYear && offScore(p) > 60;
  }).sort((a, b) => offScore(b) - offScore(a))[0];
  if (cbpoy) {
    awards.push({ year: yr, type: "CBPOY", playerId: cbpoy.id, team: cbpoy.team!, position: cbpoy.position });
    league.news.unshift({
      id: `cbpoy${yr}`, year: yr, week: 0, ts: Date.now(), category: "Award",
      headline: `${cbpoy.firstName} ${cbpoy.lastName} (${cbpoy.position}) named ${yr} Comeback Player of the Year`,
      playerId: cbpoy.id, teamId: cbpoy.team!,
    });
  }

  // Special Teams Player of the Year — best K or P
  const specialists = players.filter((p) => p.position === "K" || p.position === "P");
  const stpoy = specialists
    .map((p) => {
      const r = statRow(p, yr);
      const score = ((r?.fgm ?? 0) * 3 + (r?.xpm ?? 0) * 1) - ((r?.fga ?? 0) - (r?.fgm ?? 0)) * 1.5;
      return { p, score };
    })
    .sort((a, b) => b.score - a.score)[0];
  if (stpoy && stpoy.p) {
    awards.push({ year: yr, type: "STPOY", playerId: stpoy.p.id, team: stpoy.p.team!, position: stpoy.p.position });
    league.news.unshift({
      id: `stpoy${yr}`, year: yr, week: 0, ts: Date.now(), category: "Award",
      headline: `${stpoy.p.firstName} ${stpoy.p.lastName} (${stpoy.p.position}) named ${yr} Special Teams Player of the Year`,
      playerId: stpoy.p.id, teamId: stpoy.p.team!,
    });
  }

  // OL Player of the Year — best by OVR among All-Pro OL players (proxy: 88+ OVR + Pro Bowl)
  const olCandidates = players
    .filter((p) => ["LT", "LG", "C", "RG", "RT"].includes(p.position) && statRow(p, yr)?.proBowl)
    .sort((a, b) => b.ovr - a.ovr);
  const olpoy = olCandidates[0];
  if (olpoy) {
    awards.push({ year: yr, type: "OLPOY", playerId: olpoy.id, team: olpoy.team!, position: olpoy.position });
    league.news.unshift({
      id: `olpoy${yr}`, year: yr, week: 0, ts: Date.now(), category: "Award",
      headline: `${olpoy.firstName} ${olpoy.lastName} (${olpoy.position}) named ${yr} Offensive Lineman of the Year`,
      playerId: olpoy.id, teamId: olpoy.team!,
    });
  }

  // Walter Payton-style Citizenship Award — vet with 8+ seasons + Pro Bowl this year
  const citizenship = players
    .filter((p) => p.history.length >= 8 && statRow(p, yr)?.proBowl && !awards.some((a) => a.playerId === p.id && a.type === "MVP"))
    .sort((a, b) => b.history.length - a.history.length)[0];
  if (citizenship) {
    awards.push({ year: yr, type: "Citizenship", playerId: citizenship.id, team: citizenship.team!, position: citizenship.position });
    league.news.unshift({
      id: `cit${yr}`, year: yr, week: 0, ts: Date.now(), category: "Award",
      headline: `${citizenship.firstName} ${citizenship.lastName} (${citizenship.position}) wins ${yr} Walter Payton Award for community impact`,
      playerId: citizenship.id, teamId: citizenship.team!,
    });
  }

  return awards;
}
