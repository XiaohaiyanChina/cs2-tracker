import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMatches, useTeams } from '../hooks/useData';
import { CalendarDays } from 'lucide-react';
import type { Match, Team } from '../types';

type TabType = 'today' | 'past' | 'upcoming';

function isToday(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  return d.toDateString() === today.toDateString();
}

function MatchCard({ match, teams }: { match: Match; teams: Team[] }) {
  const teamA = teams.find(t => t.id === match.teamAId);
  const teamB = teams.find(t => t.id === match.teamBId);
  const isLive = match.status === 'live';
  const finished = match.status === 'finished';
  const teamAWon = finished && match.scoreA > match.scoreB;
  const teamBWon = finished && match.scoreB > match.scoreA;

  return (
    <Link
      to={`/matches/${match.id}`}
      className={`block bg-surface border rounded-md px-3.5 py-2.5 hover:border-accent/40 transition-all ${
        isLive ? 'border-danger/30 ring-1 ring-danger/20' : 'border-border'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Time / Status */}
        <div className="w-12 shrink-0 text-right">
          {isLive ? (
            <div className="flex items-center justify-end gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse" />
              <span className="text-[10px] font-bold text-danger uppercase">LIVE</span>
            </div>
          ) : (
            <span className="text-[10px] text-muted leading-tight">
              {new Date(match.date).toLocaleDateString('zh-CN')}<br/>
              {new Date(match.date).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        {/* Team A */}
        <div className="flex-1 min-w-0 text-right">
          <div className="flex items-center justify-end gap-2">
            <span className={`text-xs font-semibold truncate ${teamAWon ? 'text-text' : 'text-muted'}`}>
              {teamA?.name || 'TBD'}
            </span>
            {teamA?.logo && <img src={teamA.logo} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" />}
          </div>
        </div>

        {/* Score */}
        <div className="shrink-0 text-center min-w-[60px]">
          {finished ? (
            <div className="flex items-center justify-center gap-1.5">
              <span className={`text-lg font-bold tabular-nums ${teamAWon ? 'text-text' : 'text-muted'}`}>
                {match.scoreA}
              </span>
              <span className="text-border text-sm">:</span>
              <span className={`text-lg font-bold tabular-nums ${teamBWon ? 'text-text' : 'text-muted'}`}>
                {match.scoreB}
              </span>
            </div>
          ) : (
            <span className="text-xs font-bold text-muted">vs</span>
          )}
        </div>

        {/* Team B */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {teamB?.logo && <img src={teamB.logo} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" />}
            <span className={`text-xs font-semibold truncate ${teamBWon ? 'text-text' : 'text-muted'}`}>
              {teamB?.name || 'TBD'}
            </span>
          </div>
        </div>

        {/* Format badge */}
        <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded ${
          isLive ? 'bg-danger text-white' :
          finished ? 'bg-border text-muted' :
          'bg-info/15 text-info'
        }`}>
          {isLive ? 'LIVE' : match.format.toUpperCase()}
        </span>
      </div>

      {/* ELO change */}
      {finished && match.eloChangeA !== 0 && (
        <div className="flex justify-between mt-1.5 text-[10px]">
          <span className={match.eloChangeA > 0 ? 'text-positive font-semibold' : 'text-danger'}>
            {match.eloChangeA > 0 ? '+' : ''}{match.eloChangeA} ELO
          </span>
          <span className={match.eloChangeB > 0 ? 'text-positive font-semibold' : 'text-danger'}>
            {match.eloChangeB > 0 ? '+' : ''}{match.eloChangeB} ELO
          </span>
        </div>
      )}
    </Link>
  );
}

export default function Dashboard() {
  const [tab, setTab] = useState<TabType>('today');
  const { data: matches, loading } = useMatches();
  const { data: teams } = useTeams();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const todayMatches = matches?.filter(m => isToday(m.date) || m.status === 'live') || [];
  const pastMatches = matches?.filter(m => m.status === 'finished' && !isToday(m.date))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) || [];
  const upcomingMatches = matches?.filter(m => m.status === 'upcoming')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) || [];

  const tabs = [
    { key: 'today' as TabType, label: '今日', count: todayMatches.length },
    { key: 'past' as TabType, label: '往期', count: pastMatches.length },
    { key: 'upcoming' as TabType, label: '预告', count: upcomingMatches.length },
  ];

  const displayMatches = tab === 'today' ? todayMatches : tab === 'past' ? pastMatches : upcomingMatches;

  // Live matches
  const liveMatches = todayMatches.filter(m => m.status === 'live');

  return (
    <div className="max-w-4xl mx-auto px-4 py-5">
      {/* Live bar */}
      {liveMatches.length > 0 && (
        <div className="bg-surface border border-danger/20 rounded-md px-3.5 py-2 mb-4 flex items-center gap-2 border-l-[3px] border-l-danger">
          <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse shrink-0" />
          <span className="text-[11px] font-bold text-danger uppercase tracking-wide">LIVE</span>
          <span className="text-xs text-muted ml-1">
            {liveMatches.map(m => {
              const a = teams?.find(t => t.id === m.teamAId);
              const b = teams?.find(t => t.id === m.teamBId);
              return `${a?.name || '?'} ${m.scoreA}:${m.scoreB} ${b?.name || '?'}`;
            }).join('  ·  ')}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-sm font-bold text-text flex items-center gap-2 uppercase tracking-wider">
          <CalendarDays className="w-4 h-4 text-accent" />
          赛程中心
        </h1>
        <span className="text-[10px] text-muted">{matches?.length || 0} 场比赛</span>
      </div>

      {/* Tab pills */}
      <div className="flex gap-1.5 mb-5">
        {tabs.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3.5 py-1.5 rounded-full text-[11px] font-semibold transition-colors ${
              tab === key
                ? 'bg-accent text-white'
                : 'text-muted border border-border hover:text-text hover:border-muted'
            }`}
          >
            {label} <span className="opacity-70 ml-0.5">{count}</span>
          </button>
        ))}
      </div>

      {/* Match list */}
      <div className="space-y-1.5">
        {displayMatches.map(m => (
          <MatchCard key={m.id} match={m} teams={teams || []} />
        ))}
        {displayMatches.length === 0 && (
          <div className="text-center py-16 bg-surface rounded-lg border border-border">
            <CalendarDays className="w-10 h-10 mx-auto mb-2 text-border" />
            <p className="text-muted text-sm">暂无比赛数据</p>
          </div>
        )}
      </div>
    </div>
  );
}
