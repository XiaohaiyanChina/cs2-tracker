import { API_BASE } from './config';

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const api = {
  players: {
    list: () => fetchJSON<import('../types').Player[]>('/players'),
    get: (id: string) => fetchJSON<import('../types').Player>(`/players/${id}`),
  },
  teams: {
    list: () => fetchJSON<import('../types').Team[]>('/teams'),
    get: (id: string) => fetchJSON<import('../types').Team>(`/teams/${id}`),
  },
  tournaments: {
    list: () => fetchJSON<import('../types').Tournament[]>('/tournaments'),
    get: (id: string) => fetchJSON<import('../types').Tournament>(`/tournaments/${id}`),
  },
  matches: {
    list: () => fetchJSON<import('../types').Match[]>('/matches'),
    get: (id: string) => fetchJSON<import('../types').Match>(`/matches/${id}`),
  },
  matchMaps: {
    list: () => fetchJSON<import('../types').MatchMap[]>('/matchMaps'),
  },
  matchStats: {
    list: () => fetchJSON<import('../types').MatchStat[]>('/matchStats'),
  },
  news: {
    list: () => fetchJSON<import('../types').News[]>('/news'),
  },
};
