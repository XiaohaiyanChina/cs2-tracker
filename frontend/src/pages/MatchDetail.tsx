import { useParams, Link } from 'react-router-dom';
import { useMatch, useMatchMaps, useMatchStats, usePlayers, useTeams, useTournaments } from '../hooks/useData';
import { ChevronLeft, Trophy, Calendar, Target } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { MatchStat } from '../types';

const STAT_COLS = [
  { key: 'kills', label: 'K', color: 'text-green-600' },
  { key: 'deaths', label: 'D', color: 'text-red-500' },
  { key: 'assists', label: 'A', color: 'text-gray-600' },
  { key: 'kd', label: '+/-', color: '' },
  { key: 'adr', label: 'ADR', color: 'text-gray-700' },
  { key: 'rating', label: 'Rating', color: '' },
  { key: 'hs', label: 'HS%', color: 'text-gray-500' },
  { key: 'entry', label: '首杀', color: 'text-gray-700' },
  { key: 'clutches', label: '残局', color: 'text-gray-700' },
];

function SideBySideStats({ stats, players, teams, match, showMaps }: { stats: any[], players: any, teams: any, match: any, showMaps?: boolean }) {
  const teamA = teams?.find((t: any) => t.id === match.teamAId);
  const teamB = teams?.find((t: any) => t.id === match.teamBId);

  const sideA = stats.filter((s: any) => {
    const pTeam = teams?.find((t: any) => t.members?.includes(s.playerId) || t.coach === s.playerId);
    return pTeam?.id === match.teamAId;
  });
  const sideB = stats.filter((s: any) => {
    const pTeam = teams?.find((t: any) => t.members?.includes(s.playerId) || t.coach === s.playerId);
    return pTeam?.id === match.teamBId;
  });

  function getVal(s: any, key: string) {
    switch (key) {
      case 'kills': return s.kills;
      case 'deaths': return s.deaths;
      case 'assists': return s.assists;
      case 'kd': { const d = s.kills - s.deaths; return d > 0 ? `+${d}` : `${d}`; }
      case 'adr': return (s.adr ?? 0).toFixed(1);
      case 'rating': return (s.rating ?? 0).toFixed(2);
      case 'hs': return `${((s.headshotPercent ?? s.hs) ?? 0).toFixed(0)}%`;
      case 'entry': return s.entryKills ?? s.entry ?? 0;
      case 'clutches': return s.clutches ?? 0;
      default: return '';
    }
  }

  function getColor(s: any, key: string) {
    if (key === 'kd') {
      const d = s.kills - s.deaths;
      return d >= 0 ? 'text-green-600' : 'text-red-500';
    }
    if (key === 'rating') {
      const r = s.rating ?? 0;
      return r >= 1.2 ? 'text-green-600' : r < 0.9 ? 'text-red-500' : 'text-gray-700';
    }
    return STAT_COLS.find(c => c.key === key)?.color || 'text-gray-700';
  }

  function renderSide(statsArr: any[], sideTeam: any) {
    return (
      <div className="flex-1 min-w-0">
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-700">{sideTeam?.name || 'TBD'}</span>
          <span className="text-xs text-gray-400 ml-1">[{sideTeam?.tag}]</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-3 py-2 text-xs text-gray-400 font-medium">选手</th>
                {showMaps && <th className="text-center px-2 py-2 text-xs text-gray-400 font-medium">图</th>}
                {STAT_COLS.map(c => (
                  <th key={c.key} className="text-center px-2 py-2 text-xs text-gray-400 font-medium">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {statsArr.length === 0 ? (
                <tr><td colSpan={STAT_COLS.length + (showMaps ? 2 : 1)} className="text-center text-gray-400 py-6">暂无数据</td></tr>
              ) : (
                statsArr.map((s: any) => {
                  const p = players?.find((x: any) => x.id === s.playerId);
                  return (
                    <tr key={s.playerId + (s.id || '')} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-3 py-2">
                        <Link to={`/players/${p?.id}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                          {p?.avatar ? (
                            <img src={p.avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500">
                              {p?.nickname?.charAt(0) || '?'}
                            </div>
                          )}
                          <span className="text-sm font-medium text-gray-900 truncate max-w-[100px]">{p?.nickname || '?'}</span>
                        </Link>
                      </td>
                      {showMaps && <td className="text-center font-mono text-xs text-gray-400">{s.maps}</td>}
                      {STAT_COLS.map(c => (
                        <td key={c.key} className={`text-center px-2 py-2 font-mono text-xs font-bold ${getColor(s, c.key)}`}>
                          {getVal(s, c.key)}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="flex divide-x divide-gray-200">
      {renderSide(sideA, teamA)}
      {renderSide(sideB, teamB)}
    </div>
  );
}

export default function MatchDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: match, loading } = useMatch(id || '');
  const { data: allMaps } = useMatchMaps();
  const { data: allStats } = useMatchStats();
  const { data: players } = usePlayers();
  const { data: teams } = useTeams();
  const { data: tournaments } = useTournaments();

  const [tab, setTab] = useState<string>('aggregate');

  const teamA = teams?.find(t => t.id === match?.teamAId);
  const teamB = teams?.find(t => t.id === match?.teamBId);
  const tournament = tournaments?.find(t => t.id === match?.tournamentId);

  const maps = useMemo(() => {
    if (!allMaps || !match) return [];
    return match.mapIds.map(mid => allMaps.find(m => m.id === mid)).filter(Boolean);
  }, [allMaps, match]);

  const mapStats = useMemo(() => {
    if (!allStats || !match) return new Map<string, MatchStat[]>();
    const m = new Map<string, MatchStat[]>();
    match.mapIds.forEach(mapId => {
      m.set(mapId, allStats.filter(s => s.matchMapId === mapId));
    });
    return m;
  }, [allStats, match]);

  const aggregateStats = useMemo(() => {
    const all: MatchStat[] = [];
    mapStats.forEach(stats => all.push(...stats));
    const byPlayer = new Map<string, MatchStat[]>();
    all.forEach(s => {
      const arr = byPlayer.get(s.playerId) || [];
      arr.push(s);
      byPlayer.set(s.playerId, arr);
    });
    return Array.from(byPlayer.entries()).map(([pid, stats]) => ({
      playerId: pid,
      id: pid,
      kills: stats.reduce((a, s) => a + s.kills, 0),
      deaths: stats.reduce((a, s) => a + s.deaths, 0),
      assists: stats.reduce((a, s) => a + s.assists, 0),
      adr: stats.reduce((a, s) => a + s.adr, 0) / stats.length,
      rating: stats.reduce((a, s) => a + s.rating, 0) / stats.length,
      headshotPercent: stats.reduce((a, s) => a + s.headshotPercent, 0) / stats.length,
      entryKills: stats.reduce((a, s) => a + s.entryKills, 0),
      clutches: stats.reduce((a, s) => a + s.clutches, 0),
      maps: stats.length,
    })).sort((a, b) => b.rating - a.rating);
  }, [mapStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-gray-400">
        <Target className="w-16 h-16 mx-auto mb-4 opacity-20" />
        <p className="text-lg">比赛未找到</p>
      </div>
    );
  }

  const finished = match.status === 'finished';
  const teamAWon = match.scoreA > match.scoreB;
  const teamBWon = match.scoreB > match.scoreA;

  // Build tabs: aggregate + each map
  const tabDefs = [
    { key: 'aggregate', label: '总数据' },
    ...(maps as any[]).map((map: any, i: number) => ({
      key: map.id,
      label: `图${i + 1} ${map.mapName}`,
    })),
  ];

  // Determine which stats to show based on active tab
  let activeStats: any[];
  let activeTitle: string;
  let activeShowMaps = false;
  let activeSubtitle = '';

  if (tab === 'aggregate') {
    activeStats = aggregateStats;
    activeTitle = `系列赛总数据 (${match.format.toUpperCase()})`;
    activeShowMaps = true;
  } else {
    const map = maps.find((m: any) => m.id === tab) as any;
    const rawStats = mapStats.get(tab) || [];
    activeStats = rawStats.sort((a: any, b: any) => b.rating - a.rating);
    activeTitle = map?.mapName || '';
    activeSubtitle = map ? `${map.scoreA}:${map.scoreB}${map.pickTeam ? ` · pick: ${teams?.find(t => t.id === map.pickTeam)?.tag || map.pickTeam}` : ''}` : '';
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <Link to="/" className="flex items-center gap-1 text-gray-400 hover:text-gray-600 text-sm mb-4 transition-colors">
        <ChevronLeft className="w-4 h-4" /> 返回赛程中心
      </Link>

      {/* Match Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
        <div className="text-center mb-4">
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-1">
            <Calendar className="w-4 h-4" />
            <span>{new Date(match.date).toLocaleDateString('zh-CN')} {new Date(match.date).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
            {tournament && (
              <>
                <span className="text-gray-300">|</span>
                <Trophy className="w-4 h-4 text-yellow-500" />
                <span className="text-primary font-medium">{tournament.name}</span>
              </>
            )}
          </div>
          <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded mt-1 ${
            match.status === 'live' ? 'bg-red-500 text-white animate-pulse' :
            finished ? 'bg-gray-100 text-gray-500' :
            'bg-blue-100 text-blue-600'
          }`}>
            {match.status === 'live' ? 'LIVE' : finished ? match.format.toUpperCase() : '即将开始'}
          </span>
        </div>

        <div className="flex items-center justify-center gap-6">
          <div className="flex flex-col items-center gap-2 w-40">
            {teamA?.logo ? (
              <img src={teamA.logo} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-primary/20" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-2xl font-bold text-primary">{teamA?.tag?.charAt(0) || '?'}</span>
              </div>
            )}
            <Link to={`/teams/${teamA?.id}`} className="font-semibold text-gray-900 hover:text-primary transition-colors text-center">
              {teamA?.name || 'TBD'}
            </Link>
            <span className="text-xs text-gray-400">[{teamA?.tag}]</span>
          </div>

          <div className="text-center shrink-0">
            {finished ? (
              <>
                <div className="flex items-baseline gap-3">
                  <span className={`text-5xl font-bold tabular-nums ${teamAWon ? 'text-gray-900' : 'text-gray-300'}`}>
                    {match.scoreA}
                  </span>
                  <span className="text-3xl text-gray-300 font-light">:</span>
                  <span className={`text-5xl font-bold tabular-nums ${teamBWon ? 'text-gray-900' : 'text-gray-300'}`}>
                    {match.scoreB}
                  </span>
                </div>
                {match.eloChangeA !== 0 && (
                  <div className="flex justify-center gap-4 mt-2 text-xs">
                    <span className={match.eloChangeA > 0 ? 'text-green-600' : 'text-red-500'}>
                      {match.eloChangeA > 0 ? '+' : ''}{match.eloChangeA} ELO
                    </span>
                    <span className={match.eloChangeB > 0 ? 'text-green-600' : 'text-red-500'}>
                      {match.eloChangeB > 0 ? '+' : ''}{match.eloChangeB} ELO
                    </span>
                  </div>
                )}
              </>
            ) : (
              <span className="text-3xl font-bold text-gray-300">VS</span>
            )}
          </div>

          <div className="flex flex-col items-center gap-2 w-40">
            {teamB?.logo ? (
              <img src={teamB.logo} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-primary/20" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-2xl font-bold text-primary">{teamB?.tag?.charAt(0) || '?'}</span>
              </div>
            )}
            <Link to={`/teams/${teamB?.id}`} className="font-semibold text-gray-900 hover:text-primary transition-colors text-center">
              {teamB?.name || 'TBD'}
            </Link>
            <span className="text-xs text-gray-400">[{teamB?.tag}]</span>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-white rounded-lg border border-gray-200 p-1 mb-4 overflow-x-auto">
        {tabDefs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`shrink-0 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              tab === key
                ? 'bg-primary text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Stat content */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">{activeTitle}</h2>
          {activeSubtitle && <span className="text-sm text-gray-500">{activeSubtitle}</span>}
        </div>
        <SideBySideStats
          stats={activeStats}
          players={players}
          teams={teams}
          match={match}
          showMaps={activeShowMaps}
        />
      </div>

      {maps.length === 0 && match.status === 'upcoming' && (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400 mt-6">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>比赛尚未开始，地图数据待公布</p>
        </div>
      )}
    </div>
  );
}
