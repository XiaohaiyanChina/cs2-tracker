type Status = 'upcoming' | 'live' | 'ongoing' | 'finished';

const styles: Record<Status, string> = {
  upcoming: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  live: 'bg-red-500/10 text-red-400 border-red-500/30',
  ongoing: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  finished: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
};

const labels: Record<Status, string> = {
  upcoming: '即将开始',
  live: '进行中',
  ongoing: '进行中',
  finished: '已结束',
};

export default function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${styles[status]}`}>
      {status === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
      {labels[status]}
    </span>
  );
}
