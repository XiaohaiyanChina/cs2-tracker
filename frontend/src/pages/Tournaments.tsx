import { Link } from 'react-router-dom';
import { useTournaments, useTeams } from '../hooks/useData';
import { Trophy, Clock, ChevronRight, Calendar } from 'lucide-react';

export default function Tournaments() {
  const { data: tournaments, loading } = useTournaments();
  const { data: teams } = useTeams();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const statusLabel: Record<string, string> = { upcoming: '即将开始', ongoing: '进行中', finished: '已结束' };
  const formatLabel: Record<string, string> = { 'single-elim': '单败淘汰', 'double-elim': '双败淘汰', 'round-robin': '循环赛', 'groups': '小组赛+淘汰' };

  // Sort: ongoing first, then upcoming, then finished
  const sorted = [...(tournaments || [])].sort((a, b) => {
    const order: Record<string, number> = { ongoing: 0, upcoming: 1, finished: 2 };
    return (order[a.status] ?? 3) - (order[b.status] ?? 3);
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Trophy className="w-6 h-6 text-primary" />
          赛事
        </h1>
        <span className="text-sm text-gray-400">{tournaments?.length || 0} 个赛事</span>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Trophy className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg">暂无赛事</p>
          <p className="text-sm mt-1">创建赛事请前往管理员面板</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map(t => {
            const teamObjs = (t.teams || []).map(tid => teams?.find(x => x.id === tid)).filter(Boolean);
            return (
              <Link
                key={t.id}
                to={`/tournaments/${t.id}`}
                className="block bg-white border border-gray-200 rounded-xl p-5 hover:border-primary/30 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 group-hover:text-primary transition-colors pr-2 line-clamp-2">
                    {t.name}
                  </h3>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded font-medium ${
                    t.status === 'ongoing' ? 'bg-green-100 text-green-700' :
                    t.status === 'upcoming' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>{statusLabel[t.status]}</span>
                </div>

                <div className="space-y-2 text-sm text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{t.startDate} ~ {t.endDate}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatLabel[t.format]}</span>
                    <span className="text-gray-300">|</span>
                    <span>{t.teams?.length || 0} 队</span>
                  </div>
                </div>

                {teamObjs.length > 0 && (
                  <div className="flex items-center gap-1 mt-3 flex-wrap">
                    {teamObjs.slice(0, 6).map(team => (
                      <span key={team!.id} className="text-xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
                        {team!.tag || team!.name}
                      </span>
                    ))}
                    {teamObjs.length > 6 && (
                      <span className="text-xs text-gray-400">+{teamObjs.length - 6}</span>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-end mt-3 text-xs text-gray-300 group-hover:text-primary transition-colors">
                  查看详情 <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
