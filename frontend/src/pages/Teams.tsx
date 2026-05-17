import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTeams, usePlayers, useMatches } from '../hooks/useData';
import { Trophy, ChevronRight } from 'lucide-react';

export default function Teams() {
  const { data: teams, loading } = useTeams();
  const { data: players } = usePlayers();
  const { data: matches } = useMatches();

  const teamStats = useMemo(() => {
    if (!matches || !teams) return new Map<string, { wins: number; total: number }>();
    const map = new Map<string, { wins: number; total: number }>();
    matches.filter(m => m.status === 'finished').forEach(m => {
      const a = map.get(m.teamAId) || { wins: 0, total: 0 };
      const b = map.get(m.teamBId) || { wins: 0, total: 0 };
      a.total++; b.total++;
      if (m.scoreA > m.scoreB) a.wins++;
      else b.wins++;
      map.set(m.teamAId, a);
      map.set(m.teamBId, b);
    });
    return map;
  }, [matches, teams]);

  const sorted = useMemo(() => {
    return teams?.slice().sort((a, b) => b.elo - a.elo) || [];
  }, [teams]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-5">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-sm font-bold text-text uppercase tracking-wider">战队排行</h1>
        <span className="text-[10px] text-muted">ELO 积分制 · {teams?.length || 0} 支战队</span>
      </div>

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-12 text-center">#</th>
              <th>战队</th>
              <th className="text-center w-20">ELO</th>
              <th className="text-center w-24">胜率</th>
              <th className="text-center w-16">比赛</th>
              <th className="hidden sm:table-cell">队员</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((team, i) => {
              const s = teamStats.get(team.id);
              const winRate = s && s.total > 0 ? (s.wins / s.total * 100) : 0;
              const members = team.members?.map(pid => players?.find(p => p.id === pid)).filter(Boolean) || [];
              const coach = team.coach ? players?.find(p => p.id === team.coach) : null;

              return (
                <tr key={team.id}>
                  <td className="text-center">
                    {i === 0 ? (
                      <span className="inline-flex w-6 h-6 rounded-full bg-accent/15 items-center justify-center">
                        <Trophy className="w-3 h-3 text-accent" />
                      </span>
                    ) : (
                      <span className={`text-xs font-bold ${i < 3 ? 'text-muted' : 'text-border'}`}>
                        {i + 1}
                      </span>
                    )}
                  </td>
                  <td>
                    <Link to={`/teams/${team.id}`} className="flex items-center gap-2.5 hover:text-accent transition-colors">
                      {team.logo ? (
                        <img src={team.logo} alt="" className="w-7 h-7 rounded-full object-cover" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-accent/15 flex items-center justify-center">
                          <span className="text-xs font-bold text-accent">{team.tag?.charAt(0) || '?'}</span>
                        </div>
                      )}
                      <div>
                        <span className="font-semibold text-text text-xs">{team.name}</span>
                        <span className="text-muted ml-1.5 text-[10px]">[{team.tag}]</span>
                      </div>
                    </Link>
                  </td>
                  <td className="text-center font-bold text-accent font-mono text-sm">{team.elo}</td>
                  <td className="text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <div className="w-10 h-1 bg-border rounded-full overflow-hidden">
                        <div className="h-full bg-accent rounded-full" style={{ width: `${winRate}%` }} />
                      </div>
                      <span className="text-[11px] text-muted tabular-nums">{winRate.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="text-center text-xs text-muted">{s?.total || 0}</td>
                  <td className="hidden sm:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {members.slice(0, 5).map((p: any) => (
                        <Link key={p.id} to={`/players/${p.id}`} className="text-[10px] px-1.5 py-0.5 bg-border/40 rounded text-muted hover:text-accent hover:bg-accent/10 transition-colors">
                          {p.nickname}
                        </Link>
                      ))}
                      {coach && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-positive/10 text-positive rounded">
                          {coach.nickname}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <ChevronRight className="w-3.5 h-3.5 text-border" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
