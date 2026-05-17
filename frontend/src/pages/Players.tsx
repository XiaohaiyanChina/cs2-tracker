import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { usePlayers, useTeams, useMatchStats } from '../hooks/useData';
import { ChevronRight } from 'lucide-react';

export default function Players() {
  const { data: players, loading } = usePlayers();
  const { data: teams } = useTeams();
  const { data: stats } = useMatchStats();

  const ranked = useMemo(() => {
    if (!players) return [];
    return players
      .filter(p => !p.isCoach)
      .map(p => {
        const pStats = stats?.filter(s => s.playerId === p.id) || [];
        const avgRating = pStats.length > 0
          ? pStats.reduce((sum, s) => sum + s.rating, 0) / pStats.length : 0;
        const totalKills = pStats.reduce((sum, s) => sum + s.kills, 0);
        const totalDeaths = pStats.reduce((sum, s) => sum + s.deaths, 0);
        const kd = totalDeaths > 0 ? totalKills / totalDeaths : 0;
        return { ...p, avgRating, kd, count: pStats.length };
      })
      .sort((a, b) => b.avgRating - a.avgRating);
  }, [players, stats]);

  function getPlayerTeam(pid: string) {
    return teams?.find(t => t.members?.includes(pid));
  }

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
        <h1 className="text-sm font-bold text-text uppercase tracking-wider">选手排行</h1>
        <span className="text-[10px] text-muted">Rating 3.0 · {ranked.length} 位选手</span>
      </div>

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-12 text-center">#</th>
              <th>选手</th>
              <th className="hidden sm:table-cell">战队</th>
              <th className="text-center w-24">Rating</th>
              <th className="text-center w-20">K/D</th>
              <th className="text-center w-16">场次</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((p, i) => {
              const team = getPlayerTeam(p.id);
              return (
                <tr key={p.id}>
                  <td className="text-center">
                    <span className={`text-xs font-bold ${i === 0 ? 'text-accent' : i < 3 ? 'text-muted' : 'text-border'}`}>
                      {i + 1}
                    </span>
                  </td>
                  <td>
                    <Link to={`/players/${p.id}`} className="flex items-center gap-2.5 hover:text-accent transition-colors">
                      {p.avatar ? (
                        <img src={p.avatar} alt="" className="w-7 h-7 rounded-full object-cover" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-accent/15 flex items-center justify-center">
                          <span className="text-xs font-bold text-accent">{p.nickname.charAt(0)}</span>
                        </div>
                      )}
                      <div>
                        <span className="font-semibold text-text text-xs">{p.nickname}</span>
                        <span className="text-muted ml-1.5 text-[10px]">{p.realName}</span>
                      </div>
                    </Link>
                  </td>
                  <td className="hidden sm:table-cell">
                    {team && (
                      <Link to={`/teams/${team.id}`} className="text-xs text-accent hover:underline">
                        [{team.tag}]
                      </Link>
                    )}
                  </td>
                  <td className={`text-center font-bold font-mono text-sm ${p.avgRating >= 1.2 ? 'text-positive' : p.avgRating >= 0.9 ? 'text-text' : 'text-danger'}`}>
                    {p.avgRating.toFixed(2)}
                  </td>
                  <td className="text-center text-muted font-mono text-xs">{p.kd.toFixed(2)}</td>
                  <td className="text-center text-muted text-xs">{p.count}</td>
                  <td><ChevronRight className="w-3.5 h-3.5 text-border" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
