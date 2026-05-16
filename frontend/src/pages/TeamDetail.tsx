import { useParams, Link } from 'react-router-dom';
import { useTeams, usePlayers, useMatches, useMatchStats, useTournaments } from '../hooks/useData';
import { ChevronLeft, Users, Trophy, Calendar, ChevronRight } from 'lucide-react';
import { useMemo } from 'react';
import type { Achievement } from '../types';

export default function TeamDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: teams, loading } = useTeams();
  const { data: players } = usePlayers();
  const { data: matches } = useMatches();
  const { data: stats } = useMatchStats();
  const { data: tournaments } = useTournaments();

  const team = teams?.find(t => t.id === id);

  const teamMatches = useMemo(() => {
    if (!matches || !id) return [];
    return matches.filter(m => m.teamAId === id || m.teamBId === id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [matches, id]);

  const members = useMemo(() => {
    if (!team || !players || !stats) return [];
    return team.members.map(pid => {
      const p = players.find(x => x.id === pid);
      if (!p) return null;
      const pStats = stats.filter(s => s.playerId === pid);
      const avgRating = pStats.length > 0
        ? pStats.reduce((sum, s) => sum + s.rating, 0) / pStats.length : 0;
      return { ...p, avgRating, count: pStats.length };
    }).filter(Boolean).sort((a: any, b: any) => b.avgRating - a.avgRating);
  }, [team, players, stats]);

  const coach = team?.coach ? players?.find(p => p.id === team.coach) : null;

  const winRate = useMemo(() => {
    const finished = teamMatches.filter(m => m.status === 'finished');
    if (finished.length === 0) return 0;
    const wins = finished.filter(m =>
      (m.teamAId === id && m.scoreA > m.scoreB) || (m.teamBId === id && m.scoreB > m.scoreA)
    ).length;
    return (wins / finished.length * 100);
  }, [teamMatches, id]);

  const achievements = team?.achievements || [];

  const placementIcon = (placement: string) => {
    if (placement === '冠军') return '🥇';
    if (placement === '亚军') return '🥈';
    if (placement === '四强') return '🏅';
    if (placement === '八强') return '📜';
    return '🏆';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-gray-400">
        <Users className="w-16 h-16 mx-auto mb-4 opacity-20" />
        <p className="text-lg">战队未找到</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <Link to="/teams" className="flex items-center gap-1 text-gray-400 hover:text-gray-600 text-sm mb-4 transition-colors">
        <ChevronLeft className="w-4 h-4" /> 返回战队列表
      </Link>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
        <div className="flex items-center gap-5">
          {team.logo ? (
            <img src={team.logo} alt="" className="w-20 h-20 rounded-full object-cover border-2 border-primary/20" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-3xl font-bold text-primary">{team.tag?.charAt(0) || '?'}</span>
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{team.name}</h1>
            <p className="text-gray-500 text-sm">[{team.tag}]</p>
            <div className="flex items-center gap-4 mt-2 text-sm">
              <span className="text-primary font-bold text-lg">{team.elo} ELO</span>
              <span className="text-gray-400">|</span>
              <span className="text-gray-600">胜率 <strong>{winRate.toFixed(0)}%</strong></span>
              <span className="text-gray-400">|</span>
              <span className="text-gray-600">成立 {team.createdAt}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main */}
        <div className="lg:col-span-2 space-y-6">
          {/* Roster */}
          <section className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              队员 ({members.length}/5)
            </h2>
            {coach && (
              <div className="mb-3 flex items-center gap-3 p-2 bg-green-50 rounded-lg">
                <Link to={`/players/${coach.id}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                  {coach.avatar ? (
                    <img src={coach.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-sm font-bold">
                      {coach.nickname.charAt(0)}
                    </div>
                  )}
                  <div>
                    <span className="text-sm font-medium text-gray-900">{coach.nickname}</span>
                    <span className="text-xs text-green-600 ml-1.5">教练</span>
                  </div>
                </Link>
              </div>
            )}
            <div className="space-y-1">
              {members.map((m: any) => (
                <Link
                  key={m.id}
                  to={`/players/${m.id}`}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors group"
                >
                  {m.avatar ? (
                    <img src={m.avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-sm font-bold">
                      {m.nickname.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 group-hover:text-primary transition-colors">
                      {m.nickname}
                    </p>
                    <p className="text-xs text-gray-400">{m.realName}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-gray-700">{m.avgRating.toFixed(2)}</span>
                    <p className="text-[10px] text-gray-400">Rating</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary transition-colors" />
                </Link>
              ))}
            </div>
          </section>

          {/* Match History */}
          <section className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              赛事历史
            </h2>
            <div className="space-y-2">
              {teamMatches.slice(0, 10).map(m => {
                const opp = teams?.find(t => t.id === (m.teamAId === id ? m.teamBId : m.teamAId));
                const isWin = (m.teamAId === id && m.scoreA > m.scoreB) || (m.teamBId === id && m.scoreB > m.scoreA);
                const tournament = tournaments?.find(t => t.id === m.tournamentId);
                const isFinished = m.status === 'finished';
                return (
                  <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-primary/20 transition-all">
                    <span className={`w-2 h-2 rounded-full ${isFinished ? (isWin ? 'bg-green-500' : 'bg-red-400') : 'bg-blue-400'}`} />
                    <span className="text-xs text-gray-400 w-20 shrink-0">
                      {new Date(m.date).toLocaleDateString('zh-CN')}
                    </span>
                    <span className="text-sm text-gray-700 flex-1">vs {opp?.name || 'Unknown'}</span>
                    {isFinished ? (
                      <span className={`text-sm font-bold font-mono ${isWin ? 'text-green-600' : 'text-red-500'}`}>
                        {m.scoreA}:{m.scoreB}
                      </span>
                    ) : (
                      <span className="text-xs text-blue-500 font-medium">
                        {m.status === 'live' ? 'LIVE' : '即将'}
                      </span>
                    )}
                    <span className="text-xs text-gray-400 hidden sm:inline truncate max-w-[120px]">
                      {tournament?.name}
                    </span>
                  </div>
                );
              })}
              {teamMatches.length === 0 && (
                <p className="text-gray-400 text-sm py-4 text-center">暂无比赛记录</p>
              )}
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Achievements */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              战队成就
            </h3>
            {achievements.length > 0 ? (
              <div className="space-y-2">
                {achievements.map((a: Achievement) => (
                  <div key={a.id} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50">
                    <span className="text-xl">{placementIcon(a.placement)}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {a.placement} — {a.tournamentName}
                      </p>
                      <p className="text-xs text-gray-400">{a.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm py-2 text-center">暂无成就记录</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
