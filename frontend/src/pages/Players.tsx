import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { usePlayers, useTeams, useMatchStats } from '../hooks/useData';
import { Gamepad2, ChevronRight } from 'lucide-react';


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
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-2">
        <Gamepad2 className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold text-gray-900">选手排行</h1>
      </div>
      <p className="text-gray-500 text-sm mb-6">基于 Rating 3.0 排名</p>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-14 text-center">#</th>
              <th>选手</th>
              <th>战队</th>
              <th className="text-center">Rating 3.0</th>
              <th className="text-center">K/D</th>
              <th className="text-center">比赛数</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((p, i) => {
              const team = getPlayerTeam(p.id);
              return (
                <tr key={p.id}>
                  <td className="text-center">
                    <span className={`inline-flex w-6 h-6 rounded-full items-center justify-center text-xs font-bold ${
                      i === 0 ? 'bg-yellow-100 text-yellow-700' :
                      i === 1 ? 'bg-gray-100 text-gray-600' :
                      i === 2 ? 'bg-orange-100 text-orange-700' :
                      'text-gray-400'
                    }`}>
                      {i + 1}
                    </span>
                  </td>
                  <td>
                    <Link to={`/players/${p.id}`} className="flex items-center gap-3 hover:text-primary transition-colors">
                      {p.avatar ? (
                        <img src={p.avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-bold text-primary">{p.nickname.charAt(0)}</span>
                        </div>
                      )}
                      <div>
                        <span className="font-semibold text-gray-900">{p.nickname}</span>
                        <span className="text-gray-400 ml-1.5 text-xs">{p.realName}</span>
                      </div>
                    </Link>
                  </td>
                  <td>
                    {team && (
                      <Link to={`/teams/${team.id}`} className="text-sm text-primary hover:underline">
                        [{team.tag}] {team.name}
                      </Link>
                    )}
                  </td>
                  <td className="text-center font-bold text-primary font-mono">{p.avgRating.toFixed(2)}</td>
                  <td className="text-center text-gray-600 font-mono">{p.kd.toFixed(2)}</td>
                  <td className="text-center text-gray-400 text-sm">{p.count}</td>
                  <td><ChevronRight className="w-4 h-4 text-gray-300" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
