import { useParams, Link } from 'react-router-dom';
import { useTournament, useMatches, useTeams } from '../hooks/useData';
import { ChevronLeft, Trophy, Clock } from 'lucide-react';
import { useMemo } from 'react';
import BracketView from '../components/BracketView';
import { generateBracket } from '../utils/bracket';
import type { BracketSlot } from '../types';

function TeamLogo({ team, size = 'sm' }: { team: { logo?: string; tag?: string; name?: string } | null | undefined; size?: 'sm' | 'md' }) {
  const s = size === 'sm' ? 'w-5 h-5 text-[10px]' : 'w-7 h-7 text-xs';
  if (!team) return <div className={`${s} rounded-full bg-border flex items-center justify-center font-bold text-muted`}>?</div>;
  if (team.logo) return <img src={team.logo} alt="" className={`${s} rounded-full object-cover shrink-0`} />;
  return <div className={`${s} rounded-full bg-accent/15 flex items-center justify-center font-bold text-accent`}>{team.tag?.charAt(0) || '?'}</div>;
}

export default function TournamentDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: tournament, loading } = useTournament(id || '');
  const { data: allMatches } = useMatches();
  const { data: teams } = useTeams();

  const matches = useMemo(() => (allMatches || []).filter(m => m.tournamentId === id), [allMatches, id]);

  const bracketSlots: BracketSlot[] = useMemo(() => {
    if (!tournament) return [];
    if (tournament.bracketSlots && tournament.bracketSlots.length > 0) return tournament.bracketSlots;
    if (tournament.bracketType && tournament.teams.length >= 4) {
      return generateBracket(tournament.bracketType, tournament.id, tournament.teams);
    }
    if (tournament.format === 'double-elim' && tournament.teams.length >= 4) {
      return generateBracket('4_double', tournament.id, tournament.teams);
    }
    return [];
  }, [tournament]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-muted">
        <Trophy className="w-12 h-12 mx-auto mb-3 opacity-20" />
        <p className="text-sm">赛事未找到</p>
      </div>
    );
  }

  const statusLabel: Record<string, string> = { upcoming: '即将', ongoing: '进行中', finished: '已结束' };
  const formatLabel: Record<string, string> = { 'single-elim': '单败淘汰', 'double-elim': '双败淘汰', 'round-robin': '循环赛', 'groups': '小组赛+淘汰' };
  const bracketTypeLabel: Record<string, string> = { '4_single': '4队单淘', '4_double': '4队双淘', '8_single': '8队单淘', '8_double': '8队双淘' };

  const bracketType = tournament.bracketType || (tournament.format === 'double-elim' && tournament.teams.length >= 4 ? '4_double' : null);

  return (
    <div className="max-w-5xl mx-auto px-4 py-5">
      <Link to="/tournaments" className="inline-flex items-center gap-1 text-muted hover:text-text text-[11px] mb-4 transition-colors">
        <ChevronLeft className="w-3.5 h-3.5" /> 返回赛事列表
      </Link>

      {/* Header */}
      <div className="bg-surface border border-border rounded-lg p-4 mb-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-xl font-bold text-text">{tournament.name}</h1>
              <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                tournament.status === 'ongoing' ? 'bg-positive/15 text-positive' :
                tournament.status === 'upcoming' ? 'bg-info/15 text-info' :
                'bg-border text-muted'
              }`}>{statusLabel[tournament.status]}</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-border text-muted">{formatLabel[tournament.format]}</span>
              {bracketType && <span className="text-[10px] px-2 py-0.5 rounded bg-accent/15 text-accent">{bracketTypeLabel[bracketType]}</span>}
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted">
              <Clock className="w-3 h-3" /> {tournament.startDate} ~ {tournament.endDate}
              <span>· {tournament.teams?.length || 0} 支战队</span>
            </div>
            {tournament.description && <p className="text-xs text-muted mt-2">{tournament.description}</p>}
          </div>
        </div>
      </div>

      {/* Bracket Section */}
      {bracketSlots.length > 0 && (
        <div className="bg-surface border border-border rounded-lg p-4 mb-4">
          <h2 className="font-semibold text-text text-xs mb-4 flex items-center gap-2 uppercase tracking-wider">
            <Trophy className="w-4 h-4 text-accent" /> 对阵图
          </h2>
          <BracketView slots={bracketSlots} allMatches={allMatches || []} teams={teams || []} />
        </div>
      )}

      {bracketSlots.length === 0 && (
        <div className="bg-surface border border-border rounded-lg p-8 mb-4 text-center">
          <Trophy className="w-10 h-10 mx-auto mb-2 text-border" />
          <h3 className="text-muted font-medium text-sm mb-1">暂无对阵图</h3>
          <p className="text-xs text-muted">
            {tournament.teams.length < 4
              ? '需要至少4支队伍才能生成对阵图'
              : '当前赛事格式不支持自动生成对阵图，请管理员在后台配置'}
          </p>
        </div>
      )}

      {/* Schedule Section */}
      <div className="bg-surface border border-border rounded-lg p-4">
        <h2 className="font-semibold text-text text-xs mb-4 flex items-center gap-2 uppercase tracking-wider">
          <Clock className="w-4 h-4 text-accent" /> 赛程表 ({matches.length})
        </h2>

        {matches.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>队伍 A</th>
                  <th></th>
                  <th>队伍 B</th>
                  <th>比分</th>
                  <th>赛制</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {matches.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(m => {
                  const teamA = teams?.find(t => t.id === m.teamAId);
                  const teamB = teams?.find(t => t.id === m.teamBId);
                  const slot = bracketSlots.find(s => s.matchId === m.id);
                  return (
                    <tr key={m.id}>
                      <td className="text-xs text-muted whitespace-nowrap">
                        {new Date(m.date).toLocaleDateString('zh-CN')}<br />
                        <span className="text-[10px] text-muted">{new Date(m.date).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                        {slot && <span className="text-[9px] text-accent block">{slot.label}</span>}
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <TeamLogo team={teamA} size="sm" />
                          <span className={`text-xs font-medium ${m.scoreA > m.scoreB ? 'text-text' : 'text-muted'}`}>{teamA?.name || 'TBD'}</span>
                        </div>
                      </td>
                      <td className="text-center text-border text-[10px]">vs</td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <TeamLogo team={teamB} size="sm" />
                          <span className={`text-xs font-medium ${m.scoreB > m.scoreA ? 'text-text' : 'text-muted'}`}>{teamB?.name || 'TBD'}</span>
                        </div>
                      </td>
                      <td className="text-center">
                        <span className={`font-mono font-bold text-xs ${m.status === 'finished' ? 'text-text' : 'text-muted'}`}>{m.scoreA}:{m.scoreB}</span>
                      </td>
                      <td className="text-[10px] text-muted uppercase">{m.format}</td>
                      <td>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                          m.status === 'live' ? 'bg-danger text-white' :
                          m.status === 'finished' ? 'bg-border text-muted' :
                          'bg-info/15 text-info'
                        }`}>{m.status === 'live' ? 'LIVE' : m.status === 'finished' ? '已结束' : '预告'}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted text-xs">
            <Clock className="w-7 h-7 mx-auto mb-2 opacity-30" /> 暂无比赛记录
          </div>
        )}
      </div>
    </div>
  );
}
