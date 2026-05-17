import { useState, useEffect, useCallback } from 'react';
import type { Player, Team, Tournament, Match, MatchMap, MatchStat, News } from '../types';
import { API_BASE } from '../utils/config';

function useFetch<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${API_BASE}${path}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => {
        if (cancelled) return;
        if (d && typeof d === 'object' && !Array.isArray(d) && 'error' in d) {
          throw new Error(String(d.error));
        }
        setData(d);
      })
      .catch(err => { if (!cancelled) { console.error(`API ${path}:`, err.message); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [path, key]);

  const refresh = useCallback(() => setKey(k => k + 1), []);

  return { data, loading, refresh };
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
