import { useParams, Link } from 'react-router-dom';
import { usePlayers, useTeams, useMatchStats, useMatchMaps, useMatches } from '../hooks/useData';
import { ChevronLeft, TrendingUp, Medal, ArrowLeftRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import type { PlayerAttributes } from '../types';

const RADAR_LABELS: { key: keyof PlayerAttributes; label: string }[] = [
  { key: 'rating30', label: 'Rating 3.0' },
  { key: 'firepower', label: '火力输出' },
  { key: 'entrying', label: '突破能力' },
  { key: 'trading', label: '补枪效率' },
  { key: 'opening', label: '开局能力' },
  { key: 'clutching', label: '残局能力' },
  { key: 'sniping', label: '狙击能力' },
  { key: 'utility', label: '道具使用' },
];

function buildRadarData(attrs: PlayerAttributes, label: string) {
  return RADAR_LABELS.map(({ key, label: l }) => ({
    attribute: l,
    [label]: attrs[key],
  }));
}

export default function PlayerDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: players, loading } = usePlayers();
  const { data: teams } = useTeams();
  const { data: stats } = useMatchStats();
  const { data: allMaps } = useMatchMaps();
  const { data: matches } = useMatches();

  const [compareId, setCompareId] = useState<string>('');

  const player = players?.find(p => p.id === id);
  const team = teams?.find(t => t.members?.includes(id || '') || t.coach === id);
  const comparePlayer = compareId ? players?.find(p => p.id === compareId) : null;

  const playerStats = useMemo(() => {
    if (!stats || !id) return [];
    return stats.filter(s => s.playerId === id);
  }, [stats, id]);

  const aggregate = useMemo(() => {
    const s = playerStats;
    const totalKills = s.reduce((sum, st) => sum + st.kills, 0);
    const totalDeaths = s.reduce((sum, st) => sum + st.deaths, 0);
    const avgRating = s.length > 0 ? s.reduce((sum, st) => sum + st.rating, 0) / s.length : 0;
    const avgADR = s.length > 0 ? s.reduce((sum, st) => sum + st.adr, 0) / s.length : 0;
    const avgKPR = s.length > 0 ? s.reduce((sum, st) => sum + st.kpr, 0) / s.length : 0;
    const avgHS = s.length > 0 ? s.reduce((sum, st) => sum + st.headshotPercent, 0) / s.length : 0;
    const totalEntry = s.reduce((sum, st) => sum + st.entryKills, 0);
    const totalClutches = s.reduce((sum, st) => sum + st.clutches, 0);
    return { totalKills, totalDeaths, avgRating, avgADR, avgKPR, avgHS, totalEntry, totalClutches, count: s.length };
  }, [playerStats]);

  const radarData = useMemo(() => {
    if (!player) return [];
    const data = buildRadarData(player.attributes, '当前选手');
    if (comparePlayer) {
      return data.map((d, i) => ({
        ...d,
        '对比选手': comparePlayer.attributes[RADAR_LABELS[i].key],
      }));
    }
    return data;
  }, [player, comparePlayer]);

  const mapPerformance = useMemo(() => {
    if (!allMaps || !stats || !id) return [];
    const mapStats = new Map<string, { ratings: number[]; count: number }>();
    playerStats.forEach(s => {
      const map = allMaps.find(m => m.id === s.matchMapId);
      if (map) {
        const entry = mapStats.get(map.mapName) || { ratings: [], count: 0 };
        entry.ratings.push(s.rating);
        entry.count++;
        mapStats.set(map.mapName, entry);
      }
    });
    return Array.from(mapStats.entries())
      .map(([name, d]) => ({ name, rating: d.ratings.reduce((a, b) => a + b, 0) / d.ratings.length, count: d.count }))
      .sort((a, b) => b.rating - a.rating);
  }, [playerStats, allMaps]);

  const recentGames = useMemo(() => {
    return playerStats.slice(0, 8).map(s => {
      const map = allMaps?.find(m => m.id === s.matchMapId);
      const match = map ? matches?.find(m => m.id === map.matchId) : null;
      return { stat: s, map, match };
    }).filter(x => x.match);
  }, [playerStats, allMaps, matches]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!player) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-muted">
        <Medal className="w-12 h-12 mx-auto mb-3 opacity-20" />
        <p className="text-sm">选手未找到</p>
      </div>
    );
  }

  const otherPlayers = players?.filter(p => p.id !== id && !p.isCoach) || [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-5">
      <Link to="/players" className="inline-flex items-center gap-1 text-muted hover:text-text text-[11px] mb-4 transition-colors">
        <ChevronLeft className="w-3.5 h-3.5" /> 返回选手列表
      </Link>

      {/* Header */}
      <div className="bg-surface border border-border rounded-lg p-5 mb-4">
        <div className="flex items-start gap-4 flex-wrap">
          {player.avatar ? (
            <img src={player.avatar} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-border" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
              <span className="text-2xl font-bold text-accent">{player.nickname.charAt(0)}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-text">{player.nickname}</h1>
              {player.isCoach && (
                <span className="px-2 py-0.5 bg-positive/15 text-positive text-[10px] rounded-full font-semibold">教练</span>
              )}
            </div>
            <p className="text-muted text-xs">{player.realName}</p>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted">
              {player.age > 0 && <span>{player.age}岁</span>}
              {player.gender && <span>· {player.gender}</span>}
              {team && (
                <>
                  <span>·</span>
                  <Link to={`/teams/${team.id}`} className="text-accent hover:underline font-medium">
                    [{team.tag}] {team.name}
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {[
          { label: 'Rating 3.0', value: aggregate.avgRating.toFixed(2), color: 'text-accent' },
          { label: 'K/D', value: aggregate.totalDeaths > 0 ? (aggregate.totalKills / aggregate.totalDeaths).toFixed(2) : '-', color: 'text-text' },
          { label: 'ADR', value: aggregate.avgADR.toFixed(1), color: 'text-text' },
          { label: 'KPR', value: aggregate.avgKPR.toFixed(2), color: 'text-text' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-surface border border-border rounded-lg p-3 text-center">
            <p className={`text-xl font-bold ${color}`}>{value}</p>
            <p className="text-[10px] text-muted">{label}</p>
          </div>
        ))}
      </div>

      {/* Radar Chart + Comparison */}
      <div className="bg-surface border border-border rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="font-semibold text-text text-xs flex items-center gap-2 uppercase tracking-wider">
            <TrendingUp className="w-4 h-4 text-accent" />
            能力雷达
          </h2>
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-3.5 h-3.5 text-muted" />
            <select
              value={compareId}
              onChange={e => setCompareId(e.target.value)}
              className="text-[11px] border border-border rounded-md px-2.5 py-1 bg-surface text-muted focus:border-accent outline-none"
            >
              <option value="">选择对比选手...</option>
              {otherPlayers.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nickname} {(() => { const t = teams?.find(x => x.members?.includes(p.id)); return t ? `[${t.tag}]` : ''; })()}
                </option>
              ))}
            </select>
            {compareId && (
              <button onClick={() => setCompareId('')} className="text-[10px] text-danger hover:underline">
                取消
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <ResponsiveContainer width="100%" height={350}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#21262d" />
                <PolarAngleAxis dataKey="attribute" tick={{ fill: '#8b949e', fontSize: 11 }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#484f58', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 8, color: '#e6edf3' }} />
                <Radar name={player.nickname} dataKey="当前选手" stroke="#f0883e" fill="#f0883e" fillOpacity={0.15} />
                {comparePlayer && (
                  <Radar name={comparePlayer.nickname} dataKey="对比选手" stroke="#58a6ff" fill="#58a6ff" fillOpacity={0.15} />
                )}
                <Legend wrapperStyle={{ color: '#8b949e', fontSize: '11px' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1.5">
            {RADAR_LABELS.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between p-2 rounded bg-[#1c2128]">
                <span className="text-[11px] text-muted">{label}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-accent text-xs">{player.attributes[key].toFixed(0)}</span>
                  {comparePlayer && (
                    <span className="font-mono text-[11px] text-info">
                      vs {comparePlayer.attributes[key].toFixed(0)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Map Performance + Recent Games */}
        <div className="lg:col-span-2 space-y-4">
          {mapPerformance.length > 0 && (
            <section className="bg-surface border border-border rounded-lg p-4">
              <h3 className="font-semibold text-text text-xs mb-3 uppercase tracking-wider">地图表现</h3>
              <div className="space-y-2">
                {mapPerformance.slice(0, 5).map((m) => (
                  <div key={m.name} className="flex items-center gap-3">
                    <span className="text-[11px] text-muted w-20">{m.name}</span>
                    <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                      <div className="h-full bg-accent rounded-full" style={{ width: `${(m.rating / 2) * 100}%` }} />
                    </div>
                    <span className="text-[11px] font-mono text-text">{m.rating.toFixed(2)}</span>
                    <span className="text-[10px] text-muted">{m.count}场</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="bg-surface border border-border rounded-lg p-4">
            <h3 className="font-semibold text-text text-xs mb-3 uppercase tracking-wider">近期比赛</h3>
            <div className="overflow-x-auto">
              <table className="data-table min-w-[450px]">
                <thead>
                  <tr>
                    <th>对阵</th>
                    <th>地图</th>
                    <th>K/D/A</th>
                    <th>ADR</th>
                    <th>Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {recentGames.map(({ stat: s, map, match }) => {
                    if (!match) return null;
                    const oppTeam = teams?.find(t => t.id === (match.teamAId === team?.id ? match.teamBId : match.teamAId));
                    return (
                      <tr key={s.id}>
                        <td><span className="text-xs text-muted">vs {oppTeam?.name || '?'}</span></td>
                        <td className="text-muted text-xs">{map?.mapName}</td>
                        <td className="font-mono text-[11px]">
                          <span className="text-positive">{s.kills}</span>
                          <span className="text-border">/</span>
                          <span className="text-danger">{s.deaths}</span>
                          <span className="text-border">/</span>
                          <span className="text-muted">{s.assists}</span>
                        </td>
                        <td className="font-mono text-muted text-xs">{s.adr.toFixed(1)}</td>
                        <td className={`font-mono font-bold text-xs ${s.rating >= 1.2 ? 'text-positive' : s.rating < 0.9 ? 'text-danger' : 'text-muted'}`}>
                          {s.rating.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                  {recentGames.length === 0 && (
                    <tr><td colSpan={5} className="text-muted text-xs py-4 text-center">暂无数据</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Sidebar - Honors + Career Stats */}
        <div className="space-y-4">
          {player.honors && player.honors.length > 0 && (
            <div className="bg-surface border border-border rounded-lg p-4">
              <h3 className="font-semibold text-text text-xs mb-3 flex items-center gap-2 uppercase tracking-wider">
                <Medal className="w-3.5 h-3.5 text-accent" />
                个人荣誉
              </h3>
              <div className="space-y-2">
                {player.honors.map(h => (
                  <div key={h.id} className="p-2 rounded bg-accent/5 border border-accent/10">
                    <p className="text-xs font-medium text-text">{h.title}</p>
                    <p className="text-[10px] text-muted">{h.tournamentName}</p>
                    <p className="text-[10px] text-muted">{h.date}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="bg-surface border border-border rounded-lg p-4">
            <h3 className="font-semibold text-text text-xs mb-3 flex items-center gap-2 uppercase tracking-wider">
              <Medal className="w-3.5 h-3.5 text-accent" />
              生涯数据
            </h3>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between"><span className="text-muted">总击杀</span><span className="font-mono font-bold text-text">{aggregate.totalKills}</span></div>
              <div className="flex justify-between"><span className="text-muted">总死亡</span><span className="font-mono font-bold text-text">{aggregate.totalDeaths}</span></div>
              <div className="flex justify-between"><span className="text-muted">KD Ratio</span><span className="font-mono font-bold text-text">{aggregate.totalDeaths > 0 ? (aggregate.totalKills / aggregate.totalDeaths).toFixed(2) : '-'}</span></div>
              <div className="flex justify-between"><span className="text-muted">HS%</span><span className="font-mono font-bold text-text">{aggregate.avgHS.toFixed(0)}%</span></div>
              <div className="flex justify-between"><span className="text-muted">首杀</span><span className="font-mono font-bold text-text">{aggregate.totalEntry}</span></div>
              <div className="flex justify-between"><span className="text-muted">残局</span><span className="font-mono font-bold text-text">{aggregate.totalClutches}</span></div>
              <div className="flex justify-between border-t border-border pt-2"><span className="text-muted">总地图数</span><span className="font-mono font-bold text-text">{aggregate.count}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
