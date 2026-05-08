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
  type: "MVP" | "OPOY" | "DPOY" | "OROY" | "DROY" | "COY" | "SBMVP" | "ProBowl" | "AllPro1" | "AllPro2";
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
  | "Offseason:Done";

export interface DraftPick {
  year: number;
  round: number;
  pick: number;
  originalTeam: string;
  currentTeam: string;
  used?: boolean;
  playerId?: string;
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
