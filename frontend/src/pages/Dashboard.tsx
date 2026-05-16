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
  const teamAWon = match.scoreA > match.scoreB;
  const teamBWon = match.scoreB > match.scoreA;

  return (
    <Link
      to={`/matches/${match.id}`}
      className="block bg-white border border-gray-200 rounded-lg p-4 hover:border-primary/30 hover:shadow-md transition-all"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-400">
          {new Date(match.date).toLocaleDateString('zh-CN')} {' '}
          {new Date(match.date).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
          isLive ? 'bg-red-500 text-white animate-pulse' :
          finished ? 'bg-gray-100 text-gray-500' :
          'bg-blue-100 text-blue-600'
        }`}>
          {isLive ? 'LIVE' : finished ? match.format.toUpperCase() : '预告'}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* Team A */}
        <div className="flex-1 text-right min-w-0">
          <div className="flex items-center justify-end gap-2">
            <span className={`font-semibold text-sm truncate ${teamAWon ? 'text-gray-900' : 'text-gray-400'}`}>
              {teamA?.name || 'TBD'}
            </span>
            {teamA?.logo && <img src={teamA.logo} alt="" className="w-6 h-6 rounded-full object-cover" />}
          </div>
        </div>

        {/* Score */}
        <div className="shrink-0 text-center">
          {finished ? (
            <div className="flex items-center gap-1.5">
              <span className={`text-xl font-bold tabular-nums ${teamAWon ? 'text-gray-900' : 'text-gray-400'}`}>
                {match.scoreA}
              </span>
              <span className="text-gray-300">:</span>
              <span className={`text-xl font-bold tabular-nums ${teamBWon ? 'text-gray-900' : 'text-gray-400'}`}>
                {match.scoreB}
              </span>
            </div>
          ) : (
            <span className="text-sm font-bold text-gray-400">VS</span>
          )}
        </div>

        {/* Team B */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {teamB?.logo && <img src={teamB.logo} alt="" className="w-6 h-6 rounded-full object-cover" />}
            <span className={`font-semibold text-sm truncate ${teamBWon ? 'text-gray-900' : 'text-gray-400'}`}>
              {teamB?.name || 'TBD'}
            </span>
          </div>
        </div>
      </div>

      {/* ELO change */}
      {finished && match.eloChangeA !== 0 && (
        <div className="flex justify-between mt-2 text-[11px]">
          <span className={match.eloChangeA > 0 ? 'text-green-600' : 'text-red-500'}>
            {match.eloChangeA > 0 ? '+' : ''}{match.eloChangeA} ELO
          </span>
          <span className={match.eloChangeB > 0 ? 'text-green-600' : 'text-red-500'}>
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
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const todayMatches = matches?.filter(m => isToday(m.date) || m.status === 'live') || [];
  const pastMatches = matches?.filter(m => m.status === 'finished' && !isToday(m.date))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) || [];
  const upcomingMatches = matches?.filter(m => m.status === 'upcoming')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) || [];

  const tabs = [
    { key: 'today' as TabType, label: '今日赛程', count: todayMatches.length },
    { key: 'past' as TabType, label: '往日赛果', count: pastMatches.length },
    { key: 'upcoming' as TabType, label: '未来赛事', count: upcomingMatches.length },
  ];

  const displayMatches = tab === 'today' ? todayMatches : tab === 'past' ? pastMatches : upcomingMatches;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-2">
        <CalendarDays className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold text-gray-900">赛程中心</h1>
      </div>
      <p className="text-gray-500 text-sm mb-6">今日赛程、历史赛果与未来赛事一览</p>

      {/* Tab bar */}
      <div className="flex gap-1 bg-white rounded-lg border border-gray-200 p-1 mb-6">
        {tabs.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === key
                ? 'bg-primary text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      {/* Match list */}
      <div className="space-y-3">
        {displayMatches.map(m => (
          <MatchCard key={m.id} match={m} teams={teams || []} />
        ))}
        {displayMatches.length === 0 && (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <CalendarDays className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-400">暂无比赛数据</p>
          </div>
        )}
      </div>
    </div>
  );
}
