# Maverick Football

An immersive NFL franchise simulator inspired by OOTP Baseball and College Football Coach: Dynasty. Run a 32-team league, manage your roster across decades of seasons, sign free agents, draft prospects, and chase the Super Bowl.

Built as a personal hobby project. Not affiliated with the NFL.

## Features

- **32 real franchises** with division/conference structure, team colors, stadiums, and front-office prestige
- **Drive-based simulation engine** producing realistic NFL box scores (~22 PPG, ~340 yds, ~11 drives per team)
- **Full 18-week regular season** with division/conference scheduling and one bye per team
- **14-team playoff bracket** — Wild Card, Divisional, Conference Championships, Super Bowl
- **Procedurally generated rosters** — 53 men per team, ~25 attributes per player, position-specific OVR weighting
- **Career mode** with multi-decade dynasty progression: aging curves, retirements, Hall of Fame, awards
- **Free agency engine** — 6-round bidding war between CPU teams, you compete for FAs against the cap
- **7-round draft** with scouting fog (true potential is hidden behind a noisy scout grade)
- **Awards** — MVP, OPOY/DPOY, OROY/DROY, Pro Bowls, All-Pro, SB MVP
- **Player progression** — young guys grow toward potential, vets decline, breakout seasons happen
- **Persistence** — auto-saved to IndexedDB so your dynasty survives reloads
- **Mobile-first PWA** — bottom nav, large tap targets, installable on iPhone/iPad

## Tech stack

- Next.js 15 (App Router) + React 19
- TypeScript (strict)
- Tailwind CSS 3
- Zustand (state) + Dexie (IndexedDB)
- 100% client-side — no backend required

## Local development

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import the repo at <https://vercel.com/new>.
3. Hit Deploy. Defaults work.

There's nothing to configure — no env vars, no database. Saves are stored in your browser.

## Structure

```
app/                  Pages (Next App Router)
  page.tsx            Dashboard
  new-game/           League setup
  league/             Standings, schedule, stats, playoffs, teams
  team/[id]/          Overview, roster, depth chart, schedule
  player/[id]/        Player profile + career
  game/[id]/          Box score, drive log
  offseason/          Awards, FA, draft
  hall-of-fame/       Champions + HoF inductees
  news/               League news feed

components/           Shared UI
lib/
  data/               Static data (teams, names, colleges, position metadata)
  gen/                Generators (players, rosters, schedule)
  sim/                Simulation engine (game, season, playoffs)
  offseason/          Awards, retirement, progression, FA, draft
  store/              IndexedDB + Zustand league store
  rng.ts              Seeded PRNG
  types.ts            Core types
```

## Saving / resetting

- Saves persist automatically to IndexedDB under the key `maverick-football`.
- To start fresh: visit `/new-game` and create a new league (it will overwrite the existing save).

## Notes

This is an offline simulator. No real player names are used — all 1,700+ players are procedurally generated each new league. Team names, cities, divisions, and brand colors are factual reference data.
