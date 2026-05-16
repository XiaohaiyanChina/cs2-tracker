import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTeams, usePlayers, useMatches } from '../hooks/useData';
import { Users, ChevronRight, Trophy } from 'lucide-react';


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
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-2">
        <Users className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold text-gray-900">战队排行</h1>
      </div>
      <p className="text-gray-500 text-sm mb-6">基于 ELO 积分制排名</p>

      {/* Ranking table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-14 text-center">#</th>
              <th>战队</th>
              <th className="text-center">ELO</th>
              <th className="text-center">胜率</th>
              <th className="text-center">比赛数</th>
              <th>队员</th>
              <th className="w-10"></th>
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
                    <span className={`inline-flex w-7 h-7 rounded-full items-center justify-center text-xs font-bold ${
                      i === 0 ? 'bg-yellow-100 text-yellow-700' :
                      i === 1 ? 'bg-gray-100 text-gray-600' :
                      i === 2 ? 'bg-orange-100 text-orange-700' :
                      'text-gray-400'
                    }`}>
                      {i === 0 ? <Trophy className="w-3.5 h-3.5" /> : i + 1}
                    </span>
                  </td>
                  <td>
                    <Link to={`/teams/${team.id}`} className="flex items-center gap-3 hover:text-primary transition-colors">
                      {team.logo ? (
                        <img src={team.logo} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-bold text-primary">{team.tag?.charAt(0) || '?'}</span>
                        </div>
                      )}
                      <div>
                        <span className="font-semibold text-gray-900">{team.name}</span>
                        <span className="text-gray-400 ml-1.5 text-xs">[{team.tag}]</span>
                      </div>
                    </Link>
                  </td>
                  <td className="text-center font-bold text-primary font-mono text-lg">{team.elo}</td>
                  <td className="text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${winRate}%` }} />
                      </div>
                      <span className="text-sm text-gray-600">{winRate.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="text-center text-sm text-gray-600">{s?.total || 0}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {members.slice(0, 5).map((p: any) => (
                        <Link key={p.id} to={`/players/${p.id}`} className="text-xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 hover:text-primary hover:bg-primary/10 transition-colors">
                          {p.nickname}
                        </Link>
                      ))}
                      {coach && (
                        <span className="text-xs px-1.5 py-0.5 bg-green-50 text-green-600 rounded">
                          {coach.nickname} (教练)
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
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
