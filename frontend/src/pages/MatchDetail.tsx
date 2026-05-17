import { useParams, Link } from 'react-router-dom';
import { useMatch, useMatchMaps, useMatchStats, usePlayers, useTeams, useTournaments } from '../hooks/useData';
import { ChevronLeft, Trophy, Calendar } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { MatchStat } from '../types';

const STAT_COLS = [
  { key: 'kills', label: 'K', color: 'text-positive' },
  { key: 'deaths', label: 'D', color: 'text-danger' },
  { key: 'assists', label: 'A', color: 'text-info' },
  { key: 'kd', label: '+/-', color: '' },
  { key: 'adr', label: 'ADR', color: 'text-muted' },
  { key: 'rating', label: 'Rating', color: '' },
  { key: 'hs', label: 'HS%', color: 'text-muted' },
  { key: 'entry', label: '首杀', color: 'text-muted' },
  { key: 'clutches', label: '残局', color: 'text-muted' },
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
      return d >= 0 ? 'text-positive' : 'text-danger';
    }
    if (key === 'rating') {
      const r = s.rating ?? 0;
      return r >= 1.2 ? 'text-positive' : r < 0.9 ? 'text-danger' : 'text-muted';
    }
    return STAT_COLS.find(c => c.key === key)?.color || 'text-muted';
  }

  function renderSide(statsArr: any[], sideTeam: any) {
    return (
      <div className="flex-1 min-w-0">
        <div className="px-3 py-2 bg-[#1c2128] border-b border-border">
          <span className="text-xs font-semibold text-text">{sideTeam?.name || 'TBD'}</span>
          <span className="text-[10px] text-muted ml-1">[{sideTeam?.tag}]</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-2 py-1.5 text-[10px] text-muted font-medium">选手</th>
                {showMaps && <th className="text-center px-2 py-1.5 text-[10px] text-muted font-medium">图</th>}
                {STAT_COLS.map(c => (
                  <th key={c.key} className="text-center px-1.5 py-1.5 text-[10px] text-muted font-medium">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {statsArr.length === 0 ? (
                <tr><td colSpan={STAT_COLS.length + (showMaps ? 2 : 1)} className="text-center text-muted py-6 text-xs">暂无数据</td></tr>
              ) : (
                statsArr.map((s: any) => {
                  const p = players?.find((x: any) => x.id === s.playerId);
                  return (
                    <tr key={s.playerId + (s.id || '')} className="border-b border-border/50 hover:bg-[#1c2128]">
                      <td className="px-2 py-1.5">
                        <Link to={`/players/${p?.id}`} className="flex items-center gap-1.5 hover:text-accent transition-colors">
                          {p?.avatar ? (
                            <img src={p.avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-border flex items-center justify-center text-[9px] font-bold text-muted">
                              {p?.nickname?.charAt(0) || '?'}
                            </div>
                          )}
                          <span className="text-xs font-medium text-text truncate max-w-[80px]">{p?.nickname || '?'}</span>
                        </Link>
                      </td>
                      {showMaps && <td className="text-center font-mono text-[10px] text-muted">{s.maps}</td>}
                      {STAT_COLS.map(c => (
                        <td key={c.key} className={`text-center px-1.5 py-1.5 font-mono text-[10px] font-bold ${getColor(s, c.key)}`}>
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
    <div className="flex divide-x divide-border">
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
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-muted">
        <Calendar className="w-12 h-12 mx-auto mb-3 opacity-20" />
        <p className="text-sm">比赛未找到</p>
      </div>
    );
  }

  const finished = match.status === 'finished';
  const teamAWon = match.scoreA > match.scoreB;
  const teamBWon = match.scoreB > match.scoreA;

  const tabDefs = [
    { key: 'aggregate', label: '总数据' },
    ...(maps as any[]).map((map: any, i: number) => ({
      key: map.id,
      label: `图${i + 1} ${map.mapName}`,
    })),
  ];

  let activeStats: any[];
  let activeTitle: string;
  let activeShowMaps = false;
  let activeSubtitle = '';

  if (tab === 'aggregate') {
    activeStats = aggregateStats;
    activeTitle = '系列赛总数据';
    activeShowMaps = true;
  } else {
    const map = maps.find((m: any) => m.id === tab) as any;
    const rawStats = mapStats.get(tab) || [];
    activeStats = rawStats.sort((a: any, b: any) => b.rating - a.rating);
    activeTitle = map?.mapName || '';
    activeSubtitle = map ? `${map.scoreA}:${map.scoreB}${map.pickTeam ? ' · pick: ' + (teams?.find(t => t.id === map.pickTeam)?.tag || map.pickTeam) : ''}` : '';
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-5">
      <Link to="/" className="inline-flex items-center gap-1 text-muted hover:text-text text-[11px] mb-4 transition-colors">
        <ChevronLeft className="w-3.5 h-3.5" /> 返回赛程
      </Link>

      {/* Match Header */}
      <div className="bg-surface border border-border rounded-lg p-5 mb-4">
        <div className="text-center mb-4">
          <div className="flex items-center justify-center gap-2 text-[11px] text-muted mb-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>{new Date(match.date).toLocaleDateString('zh-CN')} {new Date(match.date).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
            {tournament && (
              <>
                <span className="text-border">|</span>
                <Trophy className="w-3.5 h-3.5 text-accent" />
                <span className="text-accent font-medium">{tournament.name}</span>
              </>
            )}
          </div>
          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded mt-1 ${
            match.status === 'live' ? 'bg-danger text-white animate-pulse' :
            finished ? 'bg-border text-muted' :
            'bg-info/15 text-info'
          }`}>
            {match.status === 'live' ? 'LIVE' : finished ? match.format.toUpperCase() : '即将开始'}
          </span>
        </div>

        <div className="flex items-center justify-center gap-6">
          <div className="flex flex-col items-center gap-2 w-36">
            {teamA?.logo ? (
              <img src={teamA.logo} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-border" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-accent/15 flex items-center justify-center">
                <span className="text-2xl font-bold text-accent">{teamA?.tag?.charAt(0) || '?'}</span>
              </div>
            )}
            <Link to={`/teams/${teamA?.id}`} className="font-semibold text-text hover:text-accent transition-colors text-center text-sm">
              {teamA?.name || 'TBD'}
            </Link>
            <span className="text-[10px] text-muted">[{teamA?.tag}]</span>
          </div>

          <div className="text-center shrink-0">
            {finished ? (
              <>
                <div className="flex items-baseline gap-3">
                  <span className={`text-4xl font-bold tabular-nums ${teamAWon ? 'text-text' : 'text-muted/50'}`}>
                    {match.scoreA}
                  </span>
                  <span className="text-2xl text-border font-light">:</span>
                  <span className={`text-4xl font-bold tabular-nums ${teamBWon ? 'text-text' : 'text-muted/50'}`}>
                    {match.scoreB}
                  </span>
                </div>
                {match.eloChangeA !== 0 && (
                  <div className="flex justify-center gap-4 mt-2 text-[10px]">
                    <span className={match.eloChangeA > 0 ? 'text-positive font-semibold' : 'text-danger'}>
                      {match.eloChangeA > 0 ? '+' : ''}{match.eloChangeA} ELO
                    </span>
                    <span className={match.eloChangeB > 0 ? 'text-positive font-semibold' : 'text-danger'}>
                      {match.eloChangeB > 0 ? '+' : ''}{match.eloChangeB} ELO
                    </span>
                  </div>
                )}
              </>
            ) : (
              <span className="text-2xl font-bold text-muted">VS</span>
            )}
          </div>

          <div className="flex flex-col items-center gap-2 w-36">
            {teamB?.logo ? (
              <img src={teamB.logo} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-border" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-accent/15 flex items-center justify-center">
                <span className="text-2xl font-bold text-accent">{teamB?.tag?.charAt(0) || '?'}</span>
              </div>
            )}
            <Link to={`/teams/${teamB?.id}`} className="font-semibold text-text hover:text-accent transition-colors text-center text-sm">
              {teamB?.name || 'TBD'}
            </Link>
            <span className="text-[10px] text-muted">[{teamB?.tag}]</span>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-surface rounded-lg border border-border p-1 mb-3 overflow-x-auto">
        {tabDefs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`shrink-0 px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
              tab === key
                ? 'bg-accent text-white shadow-sm'
                : 'text-muted hover:text-text'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Stat content */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-[#1c2128] border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-text text-xs">{activeTitle}</h2>
          {activeSubtitle && <span className="text-[11px] text-muted">{activeSubtitle}</span>}
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
        <div className="bg-surface border border-border rounded-lg p-10 text-center text-muted mt-4">
          <Calendar className="w-10 h-10 mx-auto mb-2 opacity-20" />
          <p className="text-xs">比赛尚未开始，地图数据待公布</p>
        </div>
      )}
    </div>
  );
}
