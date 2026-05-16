import { useParams, Link } from 'react-router-dom';
import { usePlayers, useTeams, useMatchStats, useMatchMaps, useMatches } from '../hooks/useData';
import { ChevronLeft, Gamepad2, TrendingUp, Medal, ArrowLeftRight } from 'lucide-react';
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
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!player) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-gray-400">
        <Gamepad2 className="w-16 h-16 mx-auto mb-4 opacity-20" />
        <p className="text-lg">选手未找到</p>
      </div>
    );
  }

  const otherPlayers = players?.filter(p => p.id !== id && !p.isCoach) || [];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <Link to="/players" className="flex items-center gap-1 text-gray-400 hover:text-gray-600 text-sm mb-4 transition-colors">
        <ChevronLeft className="w-4 h-4" /> 返回选手列表
      </Link>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
        <div className="flex items-start gap-5 flex-wrap">
          {player.avatar ? (
            <img src={player.avatar} alt="" className="w-20 h-20 rounded-full object-cover border-2 border-primary/20" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-3xl font-bold text-primary">{player.nickname.charAt(0)}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{player.nickname}</h1>
              {player.isCoach && (
                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">教练</span>
              )}
            </div>
            <p className="text-gray-500 text-sm">{player.realName}</p>
            <div className="flex items-center gap-3 mt-1.5 text-sm text-gray-500">
              {player.age > 0 && <span>{player.age}岁</span>}
              {player.gender && <span>· {player.gender}</span>}
              {team && (
                <>
                  <span>·</span>
                  <Link to={`/teams/${team.id}`} className="text-primary hover:underline font-medium">
                    [{team.tag}] {team.name}
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Rating 3.0', value: aggregate.avgRating.toFixed(2), color: 'text-primary' },
          { label: 'K/D', value: aggregate.totalDeaths > 0 ? (aggregate.totalKills / aggregate.totalDeaths).toFixed(2) : '-', color: 'text-gray-900' },
          { label: 'ADR', value: aggregate.avgADR.toFixed(1), color: 'text-gray-900' },
          { label: 'KPR', value: aggregate.avgKPR.toFixed(2), color: 'text-gray-900' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-400">{label}</p>
          </div>
        ))}
      </div>

      {/* Radar Chart + Comparison */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            能力雷达图
          </h2>
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-gray-400" />
            <select
              value={compareId}
              onChange={e => setCompareId(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:border-primary outline-none"
            >
              <option value="">选择对比选手...</option>
              {otherPlayers.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nickname} {(() => { const t = teams?.find(x => x.members?.includes(p.id)); return t ? `[${t.tag}]` : ''; })()}
                </option>
              ))}
            </select>
            {compareId && (
              <button onClick={() => setCompareId('')} className="text-xs text-red-500 hover:underline">
                取消对比
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Radar */}
          <div className="lg:col-span-2">
            <ResponsiveContainer width="100%" height={380}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="attribute" tick={{ fill: '#64748b', fontSize: 12 }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8 }} />
                <Radar name={player.nickname} dataKey="当前选手" stroke="#16a34a" fill="#16a34a" fillOpacity={0.2} />
                {comparePlayer && (
                  <Radar name={comparePlayer.nickname} dataKey="对比选手" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} />
                )}
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Attribute list */}
          <div className="space-y-2">
            {RADAR_LABELS.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                <span className="text-sm text-gray-700">{label}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-primary">{player.attributes[key].toFixed(0)}</span>
                  {comparePlayer && (
                    <span className="font-mono text-sm text-blue-500">
                      vs {comparePlayer.attributes[key].toFixed(0)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Performance + Recent Games */}
        <div className="lg:col-span-2 space-y-6">
          {mapPerformance.length > 0 && (
            <section className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-3">地图表现</h3>
              <div className="space-y-2">
                {mapPerformance.slice(0, 5).map((m) => (
                  <div key={m.name} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-20">{m.name}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${(m.rating / 2) * 100}%` }} />
                    </div>
                    <span className="text-sm font-mono text-gray-700">{m.rating.toFixed(2)}</span>
                    <span className="text-xs text-gray-400">{m.count}场</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3">近期比赛</h3>
            <div className="overflow-x-auto">
              <table className="data-table min-w-[500px]">
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
                        <td><span className="text-sm text-gray-700">vs {oppTeam?.name || '?'}</span></td>
                        <td className="text-gray-500 text-sm">{map?.mapName}</td>
                        <td className="font-mono text-sm">
                          <span className="text-green-600">{s.kills}</span>
                          <span className="text-gray-300">/</span>
                          <span className="text-red-500">{s.deaths}</span>
                          <span className="text-gray-300">/</span>
                          <span>{s.assists}</span>
                        </td>
                        <td className="font-mono text-gray-700">{s.adr.toFixed(1)}</td>
                        <td className={`font-mono font-bold ${s.rating >= 1.2 ? 'text-green-600' : s.rating < 0.9 ? 'text-red-500' : 'text-gray-700'}`}>
                          {s.rating.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                  {recentGames.length === 0 && (
                    <tr><td colSpan={5} className="text-gray-400 text-sm py-4 text-center">暂无数据</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Sidebar - Career Stats */}
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Medal className="w-4 h-4 text-primary" />
              生涯数据
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">总击杀</span><span className="font-mono font-bold">{aggregate.totalKills}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">总死亡</span><span className="font-mono font-bold">{aggregate.totalDeaths}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">KD Ratio</span><span className="font-mono font-bold">{aggregate.totalDeaths > 0 ? (aggregate.totalKills / aggregate.totalDeaths).toFixed(2) : '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">HS%</span><span className="font-mono font-bold">{aggregate.avgHS.toFixed(0)}%</span></div>
              <div className="flex justify-between"><span className="text-gray-500">首杀</span><span className="font-mono font-bold">{aggregate.totalEntry}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">残局</span><span className="font-mono font-bold">{aggregate.totalClutches}</span></div>
              <div className="flex justify-between border-t border-gray-100 pt-2"><span className="text-gray-500">总地图数</span><span className="font-mono font-bold">{aggregate.count}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
