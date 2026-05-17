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
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-muted">
        <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
        <p className="text-sm">战队未找到</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-5">
      <Link to="/teams" className="inline-flex items-center gap-1 text-muted hover:text-text text-[11px] mb-4 transition-colors">
        <ChevronLeft className="w-3.5 h-3.5" /> 返回战队列表
      </Link>

      {/* Header */}
      <div className="bg-surface border border-border rounded-lg p-5 mb-4">
        <div className="flex items-center gap-4">
          {team.logo ? (
            <img src={team.logo} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-border" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-accent/15 flex items-center justify-center">
              <span className="text-2xl font-bold text-accent">{team.tag?.charAt(0) || '?'}</span>
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-text">{team.name}</h1>
            <p className="text-muted text-xs">[{team.tag}]</p>
            <div className="flex items-center gap-3 mt-1.5 text-xs">
              <span className="text-accent font-bold text-sm">{team.elo} ELO</span>
              <span className="text-border">|</span>
              <span className="text-muted">胜率 <strong className="text-text">{winRate.toFixed(0)}%</strong></span>
              <span className="text-border">|</span>
              <span className="text-muted">成立 {team.createdAt}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main */}
        <div className="lg:col-span-2 space-y-4">
          {/* Roster */}
          <section className="bg-surface border border-border rounded-lg p-4">
            <h2 className="font-semibold text-text text-xs mb-3 flex items-center gap-2 uppercase tracking-wider">
              <Users className="w-4 h-4 text-accent" />
              队员 ({members.length}/5)
            </h2>
            {coach && (
              <div className="mb-3 flex items-center gap-2 p-2 bg-positive/5 border border-positive/10 rounded">
                <Link to={`/players/${coach.id}`} className="flex items-center gap-2 hover:text-accent transition-colors">
                  {coach.avatar ? (
                    <img src={coach.avatar} alt="" className="w-7 h-7 rounded-full object-cover" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-positive/15 flex items-center justify-center text-positive text-xs font-bold">
                      {coach.nickname.charAt(0)}
                    </div>
                  )}
                  <div>
                    <span className="text-xs font-medium text-text">{coach.nickname}</span>
                    <span className="text-[10px] text-positive ml-1.5">教练</span>
                  </div>
                </Link>
              </div>
            )}
            <div className="space-y-0.5">
              {members.map((m: any) => (
                <Link
                  key={m.id}
                  to={`/players/${m.id}`}
                  className="flex items-center gap-2.5 p-2 rounded hover:bg-[#1c2128] transition-colors group"
                >
                  {m.avatar ? (
                    <img src={m.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-border flex items-center justify-center text-muted text-xs font-bold">
                      {m.nickname.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-xs font-medium text-text group-hover:text-accent transition-colors">
                      {m.nickname}
                    </p>
                    <p className="text-[10px] text-muted">{m.realName}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-text">{m.avgRating.toFixed(2)}</span>
                    <p className="text-[9px] text-muted">Rating</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-border group-hover:text-accent transition-colors" />
                </Link>
              ))}
            </div>
          </section>

          {/* Match History */}
          <section className="bg-surface border border-border rounded-lg p-4">
            <h2 className="font-semibold text-text text-xs mb-3 flex items-center gap-2 uppercase tracking-wider">
              <Calendar className="w-4 h-4 text-accent" />
              赛事历史
            </h2>
            <div className="space-y-1">
              {teamMatches.slice(0, 10).map(m => {
                const opp = teams?.find(t => t.id === (m.teamAId === id ? m.teamBId : m.teamAId));
                const isWin = (m.teamAId === id && m.scoreA > m.scoreB) || (m.teamBId === id && m.scoreB > m.scoreA);
                const tournament = tournaments?.find(t => t.id === m.tournamentId);
                const isFinished = m.status === 'finished';
                return (
                  <div key={m.id} className="flex items-center gap-3 p-2.5 rounded border border-border hover:border-accent/30 transition-all">
                    <span className={`w-1.5 h-1.5 rounded-full ${isFinished ? (isWin ? 'bg-positive' : 'bg-danger') : 'bg-info'}`} />
                    <span className="text-[10px] text-muted w-16 shrink-0">
                      {new Date(m.date).toLocaleDateString('zh-CN')}
                    </span>
                    <span className="text-xs text-muted flex-1">vs {opp?.name || 'Unknown'}</span>
                    {isFinished ? (
                      <span className={`text-xs font-bold font-mono ${isWin ? 'text-positive' : 'text-danger'}`}>
                        {m.scoreA}:{m.scoreB}
                      </span>
                    ) : (
                      <span className="text-[10px] text-info font-semibold">
                        {m.status === 'live' ? 'LIVE' : '即将'}
                      </span>
                    )}
                    <span className="text-[10px] text-muted hidden sm:inline truncate max-w-[100px]">
                      {tournament ? <Link to={`/tournaments/${tournament.id}`} className="hover:text-accent hover:underline">{tournament.name}</Link> : ''}
                    </span>
                  </div>
                );
              })}
              {teamMatches.length === 0 && (
                <p className="text-muted text-xs py-4 text-center">暂无比赛记录</p>
              )}
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-surface border border-border rounded-lg p-4">
            <h3 className="font-semibold text-text text-xs mb-3 flex items-center gap-2 uppercase tracking-wider">
              <Trophy className="w-4 h-4 text-accent" />
              战队成就
            </h3>
            {achievements.length > 0 ? (
              <div className="space-y-1.5">
                {achievements.map((a: Achievement) => (
                  <div key={a.id} className="flex items-center gap-2 p-2 rounded bg-[#1c2128]">
                    <span className="text-base">{placementIcon(a.placement)}</span>
                    <div>
                      <p className="text-xs font-medium text-text">
                        {a.placement} — {a.tournamentName}
                      </p>
                      <p className="text-[10px] text-muted">{a.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted text-xs py-2 text-center">暂无成就记录</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
