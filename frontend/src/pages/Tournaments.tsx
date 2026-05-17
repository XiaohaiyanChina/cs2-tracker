import { Link } from 'react-router-dom';
import { useTournaments, useTeams } from '../hooks/useData';
import { Trophy, Clock, ChevronRight, Calendar } from 'lucide-react';

export default function Tournaments() {
  const { data: tournaments, loading } = useTournaments();
  const { data: teams } = useTeams();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const statusLabel: Record<string, string> = { upcoming: '即将', ongoing: '进行中', finished: '已结束' };
  const formatLabel: Record<string, string> = { 'single-elim': '单败淘汰', 'double-elim': '双败淘汰', 'round-robin': '循环赛', 'groups': '小组赛+淘汰' };

  const sorted = [...(tournaments || [])].sort((a, b) => {
    const order: Record<string, number> = { ongoing: 0, upcoming: 1, finished: 2 };
    return (order[a.status] ?? 3) - (order[b.status] ?? 3);
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-5">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-sm font-bold text-text flex items-center gap-2 uppercase tracking-wider">
          <Trophy className="w-4 h-4 text-accent" />
          赛事
        </h1>
        <span className="text-[10px] text-muted">{tournaments?.length || 0} 个赛事</span>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-16 text-muted">
          <Trophy className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">暂无赛事</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {sorted.map(t => {
            const teamObjs = (t.teams || []).map(tid => teams?.find(x => x.id === tid)).filter(Boolean);
            return (
              <Link
                key={t.id}
                to={`/tournaments/${t.id}`}
                className="block bg-surface border border-border rounded-lg p-4 hover:border-accent/40 hover:bg-[#1c2128] transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-text text-sm group-hover:text-accent transition-colors pr-2 line-clamp-2">
                    {t.name}
                  </h3>
                  <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded font-semibold ${
                    t.status === 'ongoing' ? 'bg-positive/15 text-positive' :
                    t.status === 'upcoming' ? 'bg-info/15 text-info' :
                    'bg-border text-muted'
                  }`}>{statusLabel[t.status]}</span>
                </div>

                <div className="space-y-1.5 text-[11px] text-muted">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" />
                    <span>{t.startDate} ~ {t.endDate}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    <span>{formatLabel[t.format]}</span>
                    <span className="text-border">|</span>
                    <span>{t.teams?.length || 0} 队</span>
                  </div>
                </div>

                {teamObjs.length > 0 && (
                  <div className="flex items-center gap-1 mt-3 flex-wrap">
                    {teamObjs.slice(0, 6).map(team => (
                      <span key={team!.id} className="text-[10px] px-1.5 py-0.5 bg-border/40 rounded text-muted">
                        {team!.tag || team!.name}
                      </span>
                    ))}
                    {teamObjs.length > 6 && (
                      <span className="text-[10px] text-muted">+{teamObjs.length - 6}</span>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-end mt-3 text-[10px] text-border group-hover:text-accent transition-colors">
                  详情 <ChevronRight className="w-3 h-3" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
