import { useState, useEffect } from 'react';
import type { Player, Team, Tournament, Match, MatchMap, MatchStat, News } from '../types';
import { API_BASE } from '../utils/config';

function useFetch<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}${path}`)
      .then(r => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [path]);

  return { data, loading };
}

export function usePlayers() { return useFetch<Player[]>('/players'); }
export function usePlayer(id: string) { return useFetch<Player>(`/players/${id}`); }
export function useTeams() { return useFetch<Team[]>('/teams'); }
export function useTeam(id: string) { return useFetch<Team>(`/teams/${id}`); }
export function useTournaments() { return useFetch<Tournament[]>('/tournaments'); }
export function useTournament(id: string) { return useFetch<Tournament>(`/tournaments/${id}`); }
export function useMatches() { return useFetch<Match[]>('/matches'); }
export function useMatch(id: string) { return useFetch<Match>(`/matches/${id}`); }
export function useMatchMaps() { return useFetch<MatchMap[]>('/matchMaps'); }
export function useMatchStats() { return useFetch<MatchStat[]>('/matchStats'); }
export function useNews() { return useFetch<News[]>('/news'); }
