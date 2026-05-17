type Status = 'upcoming' | 'live' | 'ongoing' | 'finished';

const styles: Record<Status, string> = {
  upcoming: 'bg-info/10 text-info border-info/20',
  live: 'bg-danger/10 text-danger border-danger/20',
  ongoing: 'bg-accent/10 text-accent border-accent/20',
  finished: 'bg-border text-muted border-border',
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
      {status === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse" />}
      {labels[status]}
    </span>
  );
}
