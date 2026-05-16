import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Edit3, Trash2 } from 'lucide-react';
import type { BracketSlot, Match, Team } from '../types';

function TeamLogo({ team, size = 'sm' }: { team: Team | null | undefined; size?: 'sm' | 'md' }) {
  const s = size === 'sm' ? 'w-5 h-5 text-[10px]' : 'w-7 h-7 text-xs';
  if (!team) return <div className={`${s} rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-400`}>?</div>;
  if (team.logo) return <img src={team.logo} alt="" className={`${s} rounded-full object-cover shrink-0`} />;
  return <div className={`${s} rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary`}>{team.tag?.charAt(0) || '?'}</div>;
}

function getWinner(match: Match | null | undefined): string | null {
  if (!match || match.status !== 'finished') return null;
  return match.scoreA > match.scoreB ? match.teamAId : match.teamBId;
}

function getLoser(match: Match | null | undefined): string | null {
  if (!match || match.status !== 'finished') return null;
  return match.scoreA > match.scoreB ? match.teamBId : match.teamAId;
}

function SlotCard({
  slot, match, teamA, teamB, editable, onEdit, onDelete,
}: {
  slot: BracketSlot; match: Match | null; teamA: Team | null; teamB: Team | null;
  editable?: boolean; onEdit?: () => void; onDelete?: () => void;
}) {
  const tAWon = match && match.status === 'finished' && match.scoreA > match.scoreB;
  const tBWon = match && match.status === 'finished' && match.scoreB > match.scoreA;
  const isGrand = slot.round === 'grand_final';
  const isUB = slot.round.startsWith('ub');

  return (
    <div className={`border rounded-lg shadow-sm relative group bg-white ${isGrand ? 'border-primary ring-1 ring-primary/20' : isUB ? 'border-green-200' : 'border-amber-200'}`}
      data-slot-id={slot.id} style={{ minWidth: 160, maxWidth: 180 }}>
      <div className={`text-center text-[10px] font-semibold py-0.5 rounded-t-md ${
        isUB ? 'bg-green-100 text-green-700' : slot.round.startsWith('lb') ? 'bg-amber-100 text-amber-700' : 'bg-primary/20 text-primary'
      }`}>
        {slot.label}
      </div>
      <div className="p-2 space-y-1">
        <div className="flex items-center gap-1.5">
          <TeamLogo team={teamA} size="sm" />
          <span className={`text-[11px] font-medium truncate flex-1 ${tAWon ? 'text-gray-900 font-bold' : 'text-gray-500'}`}>
            {teamA?.name || 'TBD'}
          </span>
          {match && match.status === 'finished' && <span className={`text-xs font-mono font-bold ${tAWon ? 'text-green-600' : 'text-gray-400'}`}>{match.scoreA}</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <TeamLogo team={teamB} size="sm" />
          <span className={`text-[11px] font-medium truncate flex-1 ${tBWon ? 'text-gray-900 font-bold' : 'text-gray-500'}`}>
            {teamB?.name || 'TBD'}
          </span>
          {match && match.status === 'finished' && <span className={`text-xs font-mono font-bold ${tBWon ? 'text-green-600' : 'text-gray-400'}`}>{match.scoreB}</span>}
        </div>
        {match && (
          <div className="text-[10px] text-gray-400 text-center border-t border-gray-100 pt-1">
            {new Date(match.date).toLocaleDateString('zh-CN')} {new Date(match.date).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
        {!match && <div className="text-[10px] text-gray-300 text-center border-t border-gray-100 pt-1">待定</div>}
      </div>
      {editable && (
        <div className="absolute top-1 right-1 flex gap-0.5 z-10">
          <button onClick={onEdit} className="p-0.5 bg-white border border-green-300 rounded hover:bg-green-50" title="编辑"><Edit3 className="w-3 h-3 text-green-600" /></button>
          {slot.matchId && <button onClick={onDelete} className="p-0.5 bg-white border border-red-300 rounded hover:bg-red-50" title="删除"><Trash2 className="w-3 h-3 text-red-400" /></button>}
        </div>
      )}
    </div>
  );
}

// --- Orthogonal SVG Connectors (HLTV-style: 90° angles only) ---
function OrthoConnectors({ slots, containerRef }: { slots: BracketSlot[]; containerRef: React.RefObject<HTMLDivElement | null> }) {
  const [paths, setPaths] = useState<{ d: string; color: string; key: string }[]>([]);

  const calcPaths = useCallback(() => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newPaths: typeof paths = [];

    slots.forEach(slot => {
      const srcEl = containerRef.current?.querySelector(`[data-slot-id="${slot.id}"]`) as HTMLElement | null;
      if (!srcEl) return;
      const srcRect = srcEl.getBoundingClientRect();
      const srcRight = srcRect.right - containerRect.left;
      const srcMidY = srcRect.top + srcRect.height / 2 - containerRect.top;

      const drawConn = (targetSlotId: string | null, color: string, key: string) => {
        if (!targetSlotId) return;
        const tgtEl = containerRef.current?.querySelector(`[data-slot-id="${targetSlotId}"]`) as HTMLElement | null;
        if (!tgtEl) return;
        const tgtRect = tgtEl.getBoundingClientRect();
        const tgtLeft = tgtRect.left - containerRect.left;
        const tgtMidY = tgtRect.top + tgtRect.height / 2 - containerRect.top;
        const midX = srcRight + (tgtLeft - srcRight) / 2;

        // Orthogonal path: right → right, then to mid, then up/down, then right to target
        const d = `M ${srcRight},${srcMidY} L ${midX},${srcMidY} L ${midX},${tgtMidY} L ${tgtLeft},${tgtMidY}`;
        newPaths.push({ d, color, key });
      };

      drawConn(slot.nextWinSlotId, '#16a34a', `${slot.id}_win`);
      drawConn(slot.nextLoseSlotId, '#dc2626', `${slot.id}_lose`);
    });

    setPaths(newPaths);
  }, [slots, containerRef]);

  useEffect(() => {
    calcPaths();
    const timer = setTimeout(calcPaths, 100);
    window.addEventListener('resize', calcPaths);
    return () => { clearTimeout(timer); window.removeEventListener('resize', calcPaths); };
  }, [calcPaths]);

  if (paths.length === 0) return null;

  return (
    <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0, overflow: 'visible' }}>
      <defs>
        <marker id="arrowGreen" markerWidth="6" markerHeight="5" refX="5" refY="2.5" orient="auto">
          <path d="M0,0 L6,2.5 L0,5 Z" fill="#16a34a" />
        </marker>
        <marker id="arrowRed" markerWidth="6" markerHeight="5" refX="5" refY="2.5" orient="auto">
          <path d="M0,0 L6,2.5 L0,5 Z" fill="#dc2626" />
        </marker>
      </defs>
      {paths.map(p => (
        <path key={p.key} d={p.d} stroke={p.color} strokeWidth="1.5" fill="none" opacity="0.5"
          markerEnd={p.color === '#16a34a' ? 'url(#arrowGreen)' : 'url(#arrowRed)'} />
      ))}
    </svg>
  );
}

// --- Column layout helpers ---
interface ColumnLayout {
  cols: BracketSlot[][];
  colLabels: string[];
}

function getColumnLayout(slots: BracketSlot[]): ColumnLayout {
  const hasQuarter = slots.some(s => s.round === 'ub_quarter');
  const hasLB = slots.some(s => s.round === 'lb_round1');
  const hasGrand = slots.some(s => s.round === 'grand_final');

  if (hasQuarter) {
    // 8_single: QF → SF → Final
    const qf = slots.filter(s => s.round === 'ub_quarter');
    const sf = slots.filter(s => s.round === 'ub_semi');
    const finals = slots.filter(s => s.round === 'ub_final');
    return {
      cols: [qf, sf, finals],
      colLabels: ['1/4决赛', '半决赛', '决赛'],
    };
  }

  if (hasLB && hasGrand) {
    // 4_double: UB semi → UB final → Grand final, LB round1 → LB final
    const ubSemi = slots.filter(s => s.round === 'ub_semi');
    const ubFinal = slots.filter(s => s.round === 'ub_final');
    const lbR1 = slots.filter(s => s.round === 'lb_round1');
    const lbFinal = slots.filter(s => s.round === 'lb_final');
    const grandFinal = slots.filter(s => s.round === 'grand_final');
    return {
      cols: [ubSemi, [...ubFinal, ...lbR1], lbFinal, grandFinal],
      colLabels: ['胜者组半决赛', '胜者组决赛 / 败者组第一轮', '败者组决赛', '总决赛'],
    };
  }

  // 4_single: Semi → Final
  const semi = slots.filter(s => s.round === 'ub_semi');
  const finals = slots.filter(s => s.round === 'ub_final');
  return {
    cols: [semi, finals],
    colLabels: ['半决赛', '决赛'],
  };
}

// --- Main BracketView ---
interface BracketViewProps {
  slots: BracketSlot[];
  allMatches: Match[];
  teams: Team[];
  editable?: boolean;
  onEditSlot?: (slot: BracketSlot) => void;
  onDeleteSlot?: (slot: BracketSlot) => void;
}

export default function BracketView({ slots, allMatches, teams, editable, onEditSlot, onDeleteSlot }: BracketViewProps) {
  const bracketRef = useRef<HTMLDivElement | null>(null);

  const slotMatches = useMemo(() => {
    const map = new Map<string, Match | null>();
    slots.forEach(s => { map.set(s.id, s.matchId ? (allMatches.find(m => m.id === s.matchId) || null) : null); });
    return map;
  }, [slots, allMatches]);

  const resolvedA = useMemo(() => {
    const map = new Map<string, string | null>();
    slots.forEach(s => {
      if (s.sourceA === 'fixed') { map.set(s.id, s.teamAId); return; }
      if (s.sourceSlotAId) {
        const src = slots.find(bs => bs.id === s.sourceSlotAId);
        const m = src ? slotMatches.get(src.id) ?? null : null;
        map.set(s.id, s.sourceA === 'winner_of' ? getWinner(m) : s.sourceA === 'loser_of' ? getLoser(m) : null);
      } else { map.set(s.id, null); }
    });
    return map;
  }, [slots, slotMatches]);

  const resolvedB = useMemo(() => {
    const map = new Map<string, string | null>();
    slots.forEach(s => {
      if (s.sourceB === 'fixed') { map.set(s.id, s.teamBId); return; }
      if (s.sourceSlotBId) {
        const src = slots.find(bs => bs.id === s.sourceSlotBId);
        const m = src ? slotMatches.get(src.id) ?? null : null;
        map.set(s.id, s.sourceB === 'winner_of' ? getWinner(m) : s.sourceB === 'loser_of' ? getLoser(m) : null);
      } else { map.set(s.id, null); }
    });
    return map;
  }, [slots, slotMatches]);

  const getTeam = (id: string | null | undefined) => teams.find(t => t.id === id) || null;

  const layout = useMemo(() => getColumnLayout(slots), [slots]);
  const { cols, colLabels } = layout;

  if (slots.length === 0) return null;

  const gapX = 52;
  const slotH = 100; // approximate slot height
  const totalH = Math.max(...cols.map(c => c.length * slotH + (c.length - 1) * 20)) + 20;

  return (
    <div className="overflow-x-auto pb-2">
      <div style={{ minWidth: cols.length * 230, position: 'relative' }}>
        {/* Column headers */}
        <div style={{ display: 'flex', marginBottom: 12 }}>
          {colLabels.map((label, i) => (
            <div key={i} style={{ width: 180, textAlign: 'center', marginRight: i < colLabels.length - 1 ? gapX : 0 }}>
              <span className="text-xs font-bold text-gray-500 bg-gray-100 border border-gray-200 rounded-full px-3 py-1">{label}</span>
            </div>
          ))}
        </div>

        {/* Bracket area */}
        <div ref={bracketRef} style={{ height: totalH, position: 'relative' }}>
          {cols.map((colSlots, colIdx) => {
            const left = colIdx * (180 + gapX);
            const slotSpacing = colSlots.length > 1 ? (totalH - colSlots.length * slotH) / (colSlots.length - 1) : 0;

            return colSlots.map((s, i) => {
              const top = colSlots.length === 1
                ? (totalH - slotH) / 2
                : i * (slotH + slotSpacing);

              const m = slotMatches.get(s.id) ?? null;

              return (
                <div key={s.id} style={{ position: 'absolute', left, top, width: 180 }}>
                  <SlotCard
                    slot={s} match={m}
                    teamA={getTeam(resolvedA.get(s.id))}
                    teamB={getTeam(resolvedB.get(s.id))}
                    editable={editable}
                    onEdit={() => onEditSlot?.(s)}
                    onDelete={() => onDeleteSlot?.(s)}
                  />
                </div>
              );
            });
          })}

          <OrthoConnectors slots={slots} containerRef={bracketRef} />
        </div>
      </div>
    </div>
  );
}
