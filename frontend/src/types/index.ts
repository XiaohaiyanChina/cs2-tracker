export interface PlayerAttributes {
  rating30: number;
  firepower: number;
  entrying: number;
  trading: number;
  opening: number;
  clutching: number;
  sniping: number;
  utility: number;
}

export interface PlayerHonor {
  id: string;
  playerId: string;
  title: string;
  tournamentName: string;
  date: string;
}

export interface Player {
  id: string;
  nickname: string;
  avatar: string;
  realName: string;
  age: number;
  gender: '男' | '女' | '';
  steamId: string;
  isCoach: boolean;
  attributes: PlayerAttributes;
  honors?: PlayerHonor[];
  createdAt: string;
}

export interface Achievement {
  id: string;
  teamId: string;
  tournamentName: string;
  placement: '冠军' | '亚军' | '四强' | '八强' | '参赛';
  date: string;
}

export interface Team {
  id: string;
  name: string;
  logo: string;
  tag: string;
  members: string[];
  coach: string | null;
  elo: number;
  achievements: Achievement[];
  createdAt: string;
}

export type TournamentStatus = 'upcoming' | 'ongoing' | 'finished';
export type TournamentFormat = 'single-elim' | 'double-elim' | 'round-robin' | 'groups';

export type BracketRound = 'ub_round1' | 'ub_final' | 'lb_round1' | 'lb_final' | 'grand_final';

export interface BracketSlot {
  id: string;
  round: BracketRound;
  label: string;
  matchId: string | null;
  teamAId: string | null;
  teamBId: string | null;
  nextWinSlotId: string | null;
  nextLoseSlotId: string | null;
  sourceA: 'fixed' | 'winner_of' | 'loser_of';
  sourceB: 'fixed' | 'winner_of' | 'loser_of';
  sourceSlotAId: string | null;
  sourceSlotBId: string | null;
}

export interface Tournament {
  id: string;
  name: string;
  status: TournamentStatus;
  startDate: string;
  endDate: string;
  format: TournamentFormat;
  teams: string[];
  description: string;
  bracketSlots?: BracketSlot[];
}

export type MatchStatus = 'upcoming' | 'live' | 'finished';
export type MatchFormat = 'bo1' | 'bo3' | 'bo5';

export interface Match {
  id: string;
  tournamentId: string;
  teamAId: string;
  teamBId: string;
  scoreA: number;
  scoreB: number;
  date: string;
  status: MatchStatus;
  format: MatchFormat;
  mapIds: string[];
  eloChangeA: number;
  eloChangeB: number;
}

export type MapName = 'Mirage' | 'Inferno' | 'Nuke' | 'Ancient' | 'Anubis' | 'Vertigo' | 'Dust2' | 'Overpass' | 'Train' | 'Cache';

export interface MatchMap {
  id: string;
  matchId: string;
  mapName: MapName;
  scoreA: number;
  scoreB: number;
  pickTeam: string | null;
  order: number;
}

export interface MatchStat {
  id: string;
  matchMapId: string;
  playerId: string;
  kills: number;
  deaths: number;
  assists: number;
  adr: number;
  rating: number;
  kpr: number;
  headshotPercent: number;
  entryKills: number;
  clutches: number;
}

export interface News {
  id: string;
  title: string;
  content: string;
  date: string;
  type: 'tournament' | 'match' | 'announcement';
  relatedTournamentId?: string;
}
