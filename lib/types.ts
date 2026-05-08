// ===== Core types for Maverick Football =====

export type Position =
  | "QB" | "RB" | "FB" | "WR" | "TE"
  | "LT" | "LG" | "C" | "RG" | "RT"
  | "LE" | "DT" | "RE"
  | "MLB" | "OLB"
  | "CB" | "FS" | "SS"
  | "K" | "P";

export type PositionGroup = "QB" | "RB" | "WR" | "TE" | "OL" | "DL" | "LB" | "DB" | "ST";

export type Conference = "AFC" | "NFC";
export type DivisionName = "East" | "North" | "South" | "West";

export interface DivisionId {
  conference: Conference;
  name: DivisionName;
}

export interface Team {
  id: string;             // e.g., "BUF"
  city: string;
  name: string;
  abbr: string;           // 2–3 char
  conference: Conference;
  division: DivisionName;
  primary: string;        // hex
  secondary: string;      // hex
  stadium: string;
  founded: number;
  prestige: number;       // 50–95: starting roster strength baseline
  // strategy / playstyle (affects sim & playcalling)
  offenseScheme: "Air Raid" | "West Coast" | "Spread" | "Pro Style" | "Power Run";
  defenseScheme: "4-3" | "3-4" | "Nickel D" | "Cover 2" | "Tampa 2";
  cap: number;            // salary cap dollars (millions)
  /** Weather profile for this stadium. */
  isIndoor?: boolean;
  climate?: "Cold" | "Mild" | "Warm" | "Hot";
  /** Home-field advantage 0..3. Boosts home effective ratings slightly. */
  hfa?: number;
}

// ===== Player =====

export interface Attributes {
  // common
  awr: number;     // awareness
  spd: number;     // speed
  acc: number;     // acceleration
  agi: number;     // agility
  str: number;     // strength
  jmp: number;     // jump
  sta: number;     // stamina
  dur: number;     // durability (lowers injury chance)
  // QB
  thp?: number;    // throw power
  tha?: number;    // throw accuracy short/mid/deep avg
  pac?: number;    // play action / playmaking
  tup?: number;    // tough under pressure
  // RB / skill
  car?: number;    // carrying (fumble resist)
  btk?: number;    // break tackle
  ela?: number;    // elusiveness
  vis?: number;    // vision
  cat?: number;    // catching
  rls?: number;    // release
  rte?: number;    // route running
  // OL / blocking
  pbk?: number;    // pass blocking
  rbk?: number;    // run blocking
  ibl?: number;    // impact block
  // DL / pass rush
  pmv?: number;    // power moves
  fmv?: number;    // finesse moves
  bsh?: number;    // block shed
  tak?: number;    // tackle
  // LB / DB
  pcv?: number;    // pass coverage (man)
  zcv?: number;    // zone coverage
  prc?: number;    // press
  hpw?: number;    // hit power
  // K/P
  kpw?: number;    // kick power
  kac?: number;    // kick accuracy
}

export type DepthRole = "Starter" | "Backup" | "Reserve";

export interface SeasonStatLine {
  year: number;
  team: string;
  gp: number;
  // passing
  passYds?: number; passTd?: number; passInt?: number; passAtt?: number; passCmp?: number; sacked?: number;
  // rushing
  rushYds?: number; rushTd?: number; rushAtt?: number; fumLost?: number;
  // receiving
  rec?: number; recYds?: number; recTd?: number; tgt?: number;
  // defense
  tackles?: number; sacks?: number; ints?: number; passDef?: number; ffum?: number; defTd?: number;
  // kicking
  fgm?: number; fga?: number; xpm?: number; xpa?: number; long?: number;
  // honors
  proBowl?: boolean;
  allPro?: boolean;
  mvp?: boolean;
  opoy?: boolean;
  dpoy?: boolean;
  oroy?: boolean;
  droy?: boolean;
  champion?: boolean;
}

export interface Contract {
  years: number;          // remaining
  aav: number;            // millions/year
  signedYear: number;
  signingBonus?: number;  // millions
  noTradeClause?: boolean;
  /** Years on the front of the contract that are guaranteed (cap hits even if cut). */
  guaranteedYears?: number;
}

export type InjurySeverity = "Minor" | "Moderate" | "Major" | "SeasonEnding";

export interface Injury {
  type: string;           // e.g. "Hamstring strain"
  severity: InjurySeverity;
  weeks: number;          // remaining weeks
  occurredYear: number;
  occurredWeek: number;
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  position: Position;
  team: string | null;       // team id, null if FA / retired
  jersey: number;
  age: number;
  birthYear: number;
  heightIn: number;          // inches
  weightLb: number;
  college: string;
  hometown: string;
  ovr: number;
  pot: number;               // 40–99 ceiling
  attributes: Attributes;
  contract: Contract | null;
  depth: DepthRole;
  injuryWeeks: number;       // 0 = healthy (legacy mirror of injury.weeks)
  injury?: Injury;           // active injury (typed)
  onIR?: boolean;
  onPracticeSquad?: boolean;
  retired: boolean;
  hofYear?: number;           // league HoF
  franchiseHofYear?: number;  // team HoF
  retiredJerseyTeam?: string; // team that retired their number
  draftYear: number;
  draftRound?: number;
  draftPick?: number;
  history: SeasonStatLine[];
  /** Pair-chemistry: other player id → games shared (for QB↔receiver mostly). */
  chemistry?: Record<string, number>;
  /** Holdout state. */
  holdoutWeeks?: number;
  demandsExtension?: boolean;
  /** Lineage — id of father if this is a 2nd-gen player. */
  fatherId?: string;
  /** Career milestone records broken (for the chases news feed). */
  milestones?: { year: number; week: number; text: string }[];
}

// ===== Game / Season =====

export interface DriveLog {
  team: string;             // off team id
  startYL: number;          // own yardline
  result: "TD" | "FG" | "PUNT" | "INT" | "FUM" | "DOWNS" | "EOH" | "EOG";
  plays: number;
  yards: number;
  timeSec: number;
  text: string;             // brief narrative
  scorerId?: string;
}

export interface BoxStat {
  playerId: string;
  // pass
  passCmp?: number; passAtt?: number; passYds?: number; passTd?: number; passInt?: number;
  // rush
  rushAtt?: number; rushYds?: number; rushTd?: number;
  // recv
  rec?: number; tgt?: number; recYds?: number; recTd?: number;
  // def
  tackles?: number; sacks?: number; ints?: number; ffum?: number; defTd?: number;
  // kick
  fgm?: number; fga?: number; xpm?: number; xpa?: number;
}

export interface GameResult {
  homeScore: number;
  awayScore: number;
  ot: boolean;
  drives: DriveLog[];
  homeBox: BoxStat[];
  awayBox: BoxStat[];
  homeYards: number;
  awayYards: number;
  homeTOP: number; // seconds
  awayTOP: number;
  homeTO: number;
  awayTO: number;
  topPerformers: { home: string[]; away: string[] }; // player ids
  storyline: string;
}

export type WeatherCondition = "Clear" | "Wind" | "Rain" | "Snow" | "Cold" | "Dome";

export interface Weather {
  condition: WeatherCondition;
  windMph?: number;
  tempF?: number;
}

export interface Game {
  id: string;
  year: number;
  week: number;            // 1–18 regular, 19+ playoffs
  home: string;
  away: string;
  played: boolean;
  result?: GameResult;
  // playoff metadata
  playoffRound?: "WC" | "DIV" | "CONF" | "SB";
  conference?: Conference;
  isDivisional?: boolean;
  weather?: Weather;
}

export interface StandingsRow {
  team: string;
  w: number;
  l: number;
  t: number;
  pf: number;
  pa: number;
  divW: number; divL: number;
  confW: number; confL: number;
  streak: string;          // "W3", "L1"
  seed?: number;
}

export interface Award {
  year: number;
  type: "MVP" | "OPOY" | "DPOY" | "OROY" | "DROY" | "COY" | "SBMVP"
       | "ProBowl" | "AllPro1" | "AllPro2"
       | "CBPOY" | "STPOY" | "OLPOY" | "Citizenship";
  /** For player awards. For COY this is empty / unused. */
  playerId: string;
  team: string;
  position: Position;
  /** For coaching awards. */
  coachId?: string;
}

export interface NewsItem {
  id: string;
  year: number;
  week: number;            // 0 = offseason
  ts: number;              // ordering within a week
  category: "Game" | "Trade" | "FA" | "Draft" | "Injury" | "Retire" | "Award" | "League";
  headline: string;
  body?: string;
  teamId?: string;
  playerId?: string;
}

export type Phase =
  | "Preseason"
  | "RegularSeason"
  | "Playoffs"
  | "Offseason:Awards"
  | "Offseason:Retirements"
  | "Offseason:Progression"
  | "Offseason:FreeAgency"
  | "Offseason:Draft"
  | "Offseason:Done"
  | "Offseason:Tag"
  | "Offseason:Preseason";

export interface DraftPick {
  year: number;
  round: number;
  pick: number;
  originalTeam: string;
  currentTeam: string;
  used?: boolean;
  playerId?: string;
  compensatory?: boolean;
}

export interface DraftProspect extends Player {
  scoutGrade: number;        // perceived OVR; differs from true ovr/pot
  projectedRound: number;
}

export interface FreeAgent {
  playerId: string;
  askYears: number;
  askAav: number;            // millions
  interest: Record<string, number>; // teamId -> interest score
}

// ===== Trades =====

export interface TradeAsset {
  kind: "player" | "pick";
  playerId?: string;
  /** Pick identifier "year-round-pick" e.g. "2027-1-5" */
  pickKey?: string;
}

export type TradeStatus = "pending" | "accepted" | "rejected" | "expired";

export interface TradeOffer {
  id: string;
  fromTeam: string;            // team initiating the offer
  toTeam: string;              // team receiving the offer
  fromAssets: TradeAsset[];    // assets fromTeam is giving up
  toAssets: TradeAsset[];      // assets toTeam is giving up
  status: TradeStatus;
  year: number;
  week: number;                // 0 = offseason
  ts: number;
  byUser: boolean;             // user-initiated
  message?: string;            // CPU rationale
  rejectReason?: string;
}

export interface TradeRecord {
  id: string;
  year: number;
  week: number;
  teamA: string;
  teamB: string;
  aGives: TradeAsset[];
  bGives: TradeAsset[];
  ts: number;
  headline: string;
}

// ===== Coaching =====

export type CoachRole = "HC" | "OC" | "DC";

export type OffenseScheme = "Air Raid" | "West Coast" | "Spread" | "Pro Style" | "Power Run";
export type DefenseScheme = "4-3" | "3-4" | "Nickel D" | "Cover 2" | "Tampa 2";

export interface CoachAttrs {
  /** Locker-room presence + leadership; 40–99 */
  leadership: number;
  /** Mastery of their preferred scheme; 40–99 */
  scheme: number;
  /** Player development boost (helps young players progress); 40–99 */
  development: number;
  /** Decision-making under pressure (4th-down, 2-min, late-game); 40–99 */
  decisionMaking: number;
  /** OC-only: passing-game expertise */
  passing?: number;
  /** OC-only: rushing-game expertise */
  rushing?: number;
  /** DC-only: tendency to bring extra rushers */
  blitz?: number;
  /** DC-only: coverage discipline */
  coverage?: number;
}

export interface CoachSeasonRow {
  year: number;
  team: string;
  role: CoachRole;
  w?: number;
  l?: number;
  result?: "Champion" | "Conf" | "Div" | "WC" | "Missed" | "Fired";
  coyAward?: boolean;
}

export interface Coach {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  role: CoachRole;
  team: string | null;
  yearsExperience: number;
  attrs: CoachAttrs;
  offenseScheme?: OffenseScheme;       // OC + HC may have one
  defenseScheme?: DefenseScheme;       // DC + HC may have one
  /** 0..1 — for HC, used in 4th-down decisions */
  fourthDownAgg: number;
  /** 0..1 — preferred tempo */
  tempo: number;
  reputation: number;                  // 40–95 — affects hire chance
  retired: boolean;
  history: CoachSeasonRow[];
  careerWins: number;
  careerLosses: number;
  championships: number;
  cotyAwards: number;
  /** id of the HC under whom they served as a coordinator (if any). */
  mentorId?: string;
}

export interface CoachStaff {
  teamId: string;
  hc: string;
  oc: string;
  dc: string;
}

// ===== Game plans =====

export type OffenseEmphasis = "HeavyRun" | "Balanced" | "SpreadBall" | "AirItOut";
export type DefenseEmphasis = "StopRun" | "Pressure" | "DropCoverage" | "Balanced";
export type TempoChoice = "Slow" | "Balanced" | "Hurry";

export interface GamePlan {
  gameId: string;
  teamId: string;
  offEmphasis: OffenseEmphasis;
  defEmphasis: DefenseEmphasis;
  tempo: TempoChoice;
  featuredPlayer?: string;             // own player to feature
  shadowPlayer?: string;               // opponent player to limit
  byUser: boolean;
}

// ===== User career (modes: Owner / GM / HC) =====

export type UserMode = "Owner" | "GM" | "HC";

export type UserCareerStatus = "Active" | "OnHotSeat" | "Fired" | "TakingYearOff" | "Retired";

export interface UserCareerStint {
  team: string;
  role: UserMode;
  startYear: number;
  endYear?: number;            // undefined = current
  wins: number;
  losses: number;
  playoffApps: number;
  championships: number;
  awards: string[];
  fired?: boolean;
  reason?: string;
}

export interface UserCareer {
  mode: UserMode;
  /** Reputation 40–99 — drives hire chance, salary, expectations. */
  reputation: number;
  team: string | null;
  contractYears: number;
  contractSalary: number;       // millions
  status: UserCareerStatus;
  hotSeatReason?: string;
  fireYear?: number;
  stints: UserCareerStint[];
}

export interface JobOffer {
  id: string;
  team: string;
  role: UserMode;               // "GM" or "HC"
  years: number;
  salary: number;               // millions
  expectations: "WinNow" | "Balanced" | "Rebuild";
  postedYear: number;
}

// ===== Compensatory picks, franchise tag, RFA =====

export interface CompPickAward {
  year: number;
  team: string;
  round: number;             // 3-7
  rationale: string;
}

export interface FranchiseTag {
  team: string;
  playerId: string;
  year: number;
  salary: number;
}

export type RfaTenderLevel = "first" | "second" | "original" | "right-of-first-refusal";

export interface RfaTender {
  playerId: string;
  team: string;
  level: RfaTenderLevel;
  salary: number;
  year: number;
}

// ===== Preseason =====

export interface CampNote {
  id: string;
  playerId: string;
  team: string;
  text: string;
  ovrChange?: number;
}

// ===== Achievements =====

export interface Achievement {
  id: string;            // "first_championship", "three_peat", etc.
  unlockedYear: number;
  category: "Championship" | "Career" | "Season" | "Streak" | "Roster";
  title: string;
  detail?: string;
  teamId?: string;
  playerId?: string;
}

// ===== All-Decade teams =====

export interface AllDecadeSlot {
  position: Position;
  playerId: string;
}

export interface AllDecadeTeam {
  decade: number;            // start year (e.g. 2030)
  endYear: number;
  slots: AllDecadeSlot[];
  awarded: number;           // year the team was named
}

// ===== CBA events =====

export interface CbaEvent {
  year: number;
  type: "CapStructure" | "ScheduleFormat" | "DraftFormat" | "RookieScale" | "RuleChange" | "Other";
  summary: string;
  effect?: {
    capInflationDelta?: number;
    rosterCapDelta?: number;
    /** Rule-change effects that ripple into the sim. */
    completionMultGlobal?: number;
    bigPlayRateMod?: number;
    injuryRateMod?: number;
    fgRangeBonus?: number;
    rushYpcMult?: number;
    durationYears?: number;     // how long the rule effect lasts
  };
}

// ===== Stadium upgrades + branding overrides =====

export interface StadiumState {
  team: string;
  hfa: number;             // 0-5; mirrors team.hfa as upgradable
  upgradeYear?: number;
}

export interface BrandingOverride {
  team: string;
  city?: string;
  name?: string;
  primary?: string;
  secondary?: string;
  stadium?: string;
}

// ===== Coach contracts (extending existing Coach) =====

export interface CoachContract {
  coachId: string;
  team: string;
  years: number;
  salary: number;
  signedYear: number;
}

// ===== Power rankings movement =====

export interface PowerRankSnapshot {
  year: number;
  week: number;
  rankings: string[];      // ordered team ids
}

// ===== Owner finances =====

export interface FinancesEntry {
  year: number;
  ticketRevenue: number;
  jerseyRevenue: number;
  tvDealRevenue: number;
  sponsorRevenue: number;
  payrollExpense: number;
  staffExpense: number;
  facilitiesExpense: number;
  net: number;
}

export interface TeamFinances {
  teamId: string;
  totalProfit: number;
  history: FinancesEntry[];
}

// ===== Press conference items =====

export type PressEventKind =
  | "PostGameWin" | "PostGameLoss"
  | "BigTrade" | "BigSigning" | "DraftDay" | "Hire" | "Fire"
  | "Championship" | "BadSeason" | "RookieDebut" | "MilestoneRecord";

export interface PressItem {
  id: string;
  year: number;
  week: number;
  ts: number;
  kind: PressEventKind;
  speaker: string;       // person's name
  speakerRole: "HC" | "GM" | "Owner" | "Player" | "Reporter";
  team?: string;
  quote: string;
  context?: string;      // e.g. "After 28-21 win over BUF"
}

// ===== Multi-team trade machine =====

export interface MultiTeamTradeLeg {
  teamId: string;
  giving: TradeAsset[];
  receiving: TradeAsset[];   // computed from other legs
}

export interface MultiTeamTrade {
  legs: MultiTeamTradeLeg[];
  byUser: boolean;
}

// ===== CBA mechanical effects =====

export interface CbaEffect {
  capInflationDelta?: number;     // one-time multiplier on capInflation
  completionMultGlobal?: number;  // bumps completion (e.g. defensive holding rule)
  bigPlayRateMod?: number;        // adjusts big-play probability
  injuryRateMod?: number;         // -0.20 = 20% fewer injuries
  fgRangeBonus?: number;          // -3 = effectively 3 yds shorter FGs
  rushYpcMult?: number;
  durationYears?: number;         // how long the effect persists
  appliedYear?: number;
}

// ===== Coach extensions for mentorship + tenure =====

export interface CoachMentorship {
  /** HC at the time. */
  hcId: string;
  /** Coordinator who later became an HC. */
  proteinId: string;
  startYear: number;
  endYear: number;
  team: string;
}

// ===== Scouting / Draft prep =====

export interface CombineNumbers {
  fortyYd: number;        // seconds, e.g. 4.42
  bench: number;          // reps
  vertical: number;       // inches
  broad: number;          // inches
  threeCone: number;      // seconds
}

export interface MockDraftPick {
  team: string;
  prospectId: string;
}

export interface MockDraft {
  year: number;
  publishedWeek: number;
  picks: MockDraftPick[];
}

// ===== All-time records =====

export interface RecordEntry {
  category: string;
  value: number;
  playerId?: string;
  teamId?: string;
  year?: number;
  week?: number;
}

export interface RecordsBook {
  /** Career records keyed by category. */
  career: Record<string, RecordEntry>;
  /** Single-season records. */
  season: Record<string, RecordEntry>;
  /** Single-game records. */
  game: Record<string, RecordEntry>;
}

// ===== Multi-save =====

export interface SaveMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  league: { year: number; userTeam: string | null; founded: number };
}

// ===== Franchise (per-team data that grows over time) =====

export interface FranchiseRecord {
  teamId: string;
  /** All-time team records. */
  records: RecordsBook;
  /** Players inducted into team Hall of Fame. */
  hof: string[];
  /** Retired numbers — jersey -> player id. */
  retiredNumbers: { jersey: number; playerId: string }[];
}

export interface League {
  seed: string;
  year: number;              // current season year
  phase: Phase;
  week: number;              // current week within phase
  userTeam: string | null;   // controlled team
  teams: Team[];
  players: Record<string, Player>;
  schedule: Game[];
  standings: Record<string, StandingsRow>;
  awards: Award[];
  news: NewsItem[];
  draftPicks: DraftPick[];
  draftClass: DraftProspect[];   // current upcoming draft
  freeAgents: FreeAgent[];
  pendingOffers: TradeOffer[];
  tradeLog: TradeRecord[];
  coaches: Record<string, Coach>;
  staffs: Record<string, CoachStaff>;       // keyed by team id
  coachFreeAgents: string[];                // unemployed coach ids
  gamePlans: Record<string, GamePlan>;      // keyed by `${gameId}-${teamId}`
  records: RecordsBook;                     // league-wide all-time records
  franchises: Record<string, FranchiseRecord>; // per-team records + HoF + retired numbers
  /** Player id → cap money still owed by team after they were cut, by year. */
  deadCap: Record<string, { teamId: string; year: number; amount: number; playerName: string }[]>;
  /** Per-team practice squad list (player ids). */
  practiceSquad: Record<string, string[]>;
  /** Scouting points per team for the upcoming draft (user spends; CPU has automatic). */
  scoutingPoints: Record<string, number>;
  /** Player ids that the user has scouted (revealing true potential). */
  scoutedProspects: string[];
  /** Most recent league-wide mock draft. */
  mockDraft?: MockDraft;
  /** Coaching tree mentorships. */
  mentorships: CoachMentorship[];
  /** User mode and career — Owner, GM, or HC. */
  userMode?: UserMode;
  userCareer?: UserCareer;
  /** Active job offers presented to a fired/free-agent user. */
  jobOffers: JobOffer[];
  /** Comp picks awarded based on FA gains/losses. */
  compPicks: CompPickAward[];
  /** Active franchise tags this offseason. */
  franchiseTags: FranchiseTag[];
  /** Restricted FA tenders. */
  rfaTenders: RfaTender[];
  /** Camp notes from preseason. */
  preseasonNotes: CampNote[];
  /** Dynasty achievements unlocked. */
  achievements: Achievement[];
  /** All-decade teams named every 10 years. */
  allDecadeTeams: AllDecadeTeam[];
  /** CBA / rule events that have fired. */
  cbaEvents: CbaEvent[];
  /** Stadium upgrade state per team. */
  stadiumStates: Record<string, StadiumState>;
  /** User branding overrides. */
  brandingOverrides: Record<string, BrandingOverride>;
  /** Coach contracts (keyed by coachId). */
  coachContracts: Record<string, CoachContract>;
  /** Snapshots of weekly power rankings for movement arrows. */
  powerRankingHistory: PowerRankSnapshot[];
  /** Year-over-year cap inflation factor; multiplies team.cap. */
  capInflation: number;
  /** Per-team finances tracker (Owner-mode visibility). */
  finances: Record<string, TeamFinances>;
  /** Press conference feed (separate from news). */
  press: PressItem[];
  /** Currently active rule-change effects from CBA events. */
  activeRuleEffects: CbaEffect[];
  champions: { year: number; team: string; runnerUp: string }[];
  hall: string[];                // player ids in HoF
  // dynasty meta
  founded: number;               // year league started in this save
  history: {
    year: number;
    champion: string;
    runnerUp: string;
    mvp?: string;
    sbMvp?: string;
  }[];
}
