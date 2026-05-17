import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Edit3, Trash2 } from 'lucide-react';
import type { BracketSlot, Match, Team } from '../types';

function TeamLogo({ team, size = 'sm' }: { team: Team | null | undefined; size?: 'sm' | 'md' }) {
  const s = size === 'sm' ? 'w-5 h-5 text-[10px]' : 'w-7 h-7 text-xs';
  if (!team) return <div className={`${s} rounded-full bg-border flex items-center justify-center font-bold text-muted`}>?</div>;
  if (team.logo) return <img src={team.logo} alt="" className={`${s} rounded-full object-cover shrink-0`} />;
  return <div className={`${s} rounded-full bg-accent/15 flex items-center justify-center font-bold text-accent`}>{team.tag?.charAt(0) || '?'}</div>;
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
    <div className={`border rounded-lg relative group bg-surface ${isGrand ? 'border-accent ring-1 ring-accent/20' : isUB ? 'border-positive/30' : 'border-accent/20'}`}
      data-slot-id={slot.id} style={{ minWidth: 160, maxWidth: 180 }}>
      <div className={`text-center text-[10px] font-semibold py-0.5 rounded-t-md ${
        isUB ? 'bg-positive/10 text-positive' : slot.round.startsWith('lb') ? 'bg-accent/10 text-accent' : 'bg-accent/15 text-accent'
      }`}>
        {slot.label}
      </div>
      <div className="p-2 space-y-1">
        <div className="flex items-center gap-1.5">
          <TeamLogo team={teamA} size="sm" />
          <span className={`text-[11px] font-medium truncate flex-1 ${tAWon ? 'text-text font-bold' : 'text-muted'}`}>{teamA?.name || 'TBD'}</span>
          {match && match.status === 'finished' && <span className={`text-xs font-mono font-bold ${tAWon ? 'text-positive' : 'text-muted'}`}>{match.scoreA}</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <TeamLogo team={teamB} size="sm" />
          <span className={`text-[11px] font-medium truncate flex-1 ${tBWon ? 'text-text font-bold' : 'text-muted'}`}>{teamB?.name || 'TBD'}</span>
          {match && match.status === 'finished' && <span className={`text-xs font-mono font-bold ${tBWon ? 'text-positive' : 'text-muted'}`}>{match.scoreB}</span>}
        </div>
        {match && (
          <div className="text-[10px] text-muted text-center border-t border-border pt-1">
            {new Date(match.date).toLocaleDateString('zh-CN')} {new Date(match.date).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} · {match.format.toUpperCase()}
          </div>
        )}
        {!match && <div className="text-[10px] text-muted text-center border-t border-border pt-1">待定</div>}
      </div>
      {editable && (
        <div className="absolute top-1 right-1 flex gap-0.5 z-10">
          <button onClick={onEdit} className="p-0.5 bg-surface border border-positive/30 rounded hover:bg-positive/10" title="编辑"><Edit3 className="w-3 h-3 text-positive" /></button>
          {slot.matchId && <button onClick={onDelete} className="p-0.5 bg-surface border border-danger/30 rounded hover:bg-danger/10" title="删除"><Trash2 className="w-3 h-3 text-danger" /></button>}
        </div>
      )}
    </div>
  );
}

// --- Orthogonal SVG Connectors ---
function OrthoConnectors({ slots, containerRef }: { slots: BracketSlot[]; containerRef: React.RefObject<HTMLDivElement | null> }) {
  const [paths, setPaths] = useState<{ d: string; color: string; key: string }[]>([]);

  const calcPaths = useCallback(() => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newPaths: typeof paths = [];

    const inboundCount = new Map<string, number>();
    const seen = new Map<string, number>();
    slots.forEach(s => {
      if (s.nextWinSlotId) inboundCount.set(s.nextWinSlotId, (inboundCount.get(s.nextWinSlotId) || 0) + 1);
    });

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
        const tgtH = tgtRect.height;

        const count = inboundCount.get(targetSlotId) || 1;
        const idx = seen.get(targetSlotId) || 0;
        seen.set(targetSlotId, idx + 1);
        const frac = count === 1 ? 0.5 : (idx + 1) / (count + 1);
        const tgtMidY = tgtRect.top - containerRect.top + tgtH * frac;

        const midX = srcRight + (tgtLeft - srcRight) / 2;
        const d = `M ${srcRight},${srcMidY} L ${midX},${srcMidY} L ${midX},${tgtMidY} L ${tgtLeft},${tgtMidY}`;
        newPaths.push({ d, color, key });
      };

      drawConn(slot.nextWinSlotId, '#f0883e', `${slot.id}_win`);
    });

    setPaths(newPaths);
  }, [slots, containerRef]);

  useEffect(() => {
    calcPaths();
    const timer = setTimeout(calcPaths, 200);
    window.addEventListener('resize', calcPaths);
    return () => { clearTimeout(timer); window.removeEventListener('resize', calcPaths); };
  }, [calcPaths]);

  if (paths.length === 0) return null;

  return (
    <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0, overflow: 'visible' }}>
      <defs>
        <marker id="arrowOrange" markerWidth="6" markerHeight="5" refX="5" refY="2.5" orient="auto">
          <path d="M0,0 L6,2.5 L0,5 Z" fill="#f0883e" />
        </marker>
      </defs>
      {paths.map(p => (
        <path key={p.key} d={p.d} stroke={p.color} strokeWidth="1.5" fill="none" opacity="0.3"
          markerEnd="url(#arrowOrange)" />
      ))}
    </svg>
  );
}

// --- Two-track layout ---
interface TrackLayout {
  ubCols: BracketSlot[][];
  lbCols: BracketSlot[][];
  finalSlots: BracketSlot[];
  ubLabel: string;
  lbLabel: string;
  totalCols: number;
}

function getTrackLayout(slots: BracketSlot[]): TrackLayout {
  const hasLB = slots.some(s => s.round.startsWith('lb'));
  const hasQuarter = slots.some(s => s.round === 'ub_quarter');
  const hasLB3 = slots.some(s => s.round === 'lb_round3');
  const grand = slots.filter(s => s.round === 'grand_final');

  if (hasLB3) {
    return {
      ubCols: [
        slots.filter(s => s.round === 'ub_quarter'),
        slots.filter(s => s.round === 'ub_semi'),
        slots.filter(s => s.round === 'ub_final'),
      ],
      lbCols: [
        slots.filter(s => s.round === 'lb_round1'),
        slots.filter(s => s.round === 'lb_round2'),
        slots.filter(s => s.round === 'lb_round3'),
        slots.filter(s => s.round === 'lb_final'),
      ],
      finalSlots: grand,
      ubLabel: '胜者组',
      lbLabel: '败者组',
      totalCols: 4,
    };
  }

  if (hasQuarter && !hasLB) {
    return {
      ubCols: [
        slots.filter(s => s.round === 'ub_quarter'),
        slots.filter(s => s.round === 'ub_semi'),
        slots.filter(s => s.round === 'ub_final'),
      ],
      lbCols: [],
      finalSlots: [],
      ubLabel: '1/4决赛 → 半决赛 → 决赛',
      lbLabel: '',
      totalCols: 3,
    };
  }

  if (hasLB && !hasQuarter) {
    return {
      ubCols: [
        slots.filter(s => s.round === 'ub_semi'),
        slots.filter(s => s.round === 'ub_final'),
      ],
      lbCols: [
        slots.filter(s => s.round === 'lb_round1'),
        slots.filter(s => s.round === 'lb_final'),
      ],
      finalSlots: grand,
      ubLabel: '胜者组',
      lbLabel: '败者组',
      totalCols: 2,
    };
  }

  return {
    ubCols: [
      slots.filter(s => s.round === 'ub_semi'),
      slots.filter(s => s.round === 'ub_final'),
    ],
    lbCols: [],
    finalSlots: [],
    ubLabel: '半决赛 → 决赛',
    lbLabel: '',
    totalCols: 2,
  };
}

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

  const layout = useMemo(() => getTrackLayout(slots), [slots]);
  const { ubCols, lbCols, finalSlots, ubLabel, lbLabel, totalCols } = layout;

  if (slots.length === 0) return null;

  const gapX = 52;
  const slotH = 105;
  const colW = 180;
  const hasLB = lbCols.length > 0;
  const maxUB = Math.max(...ubCols.map(c => c.length), 1);
  const maxLB = Math.max(...lbCols.map(c => c.length), 1);

  const ubBandH = maxUB * slotH + (maxUB - 1) * 24 + 10;
  const lbBandH = hasLB ? maxLB * slotH + (maxLB - 1) * 24 + 10 : 0;
  const bandGap = hasLB ? 40 : 0;
  const totalH = ubBandH + bandGap + lbBandH + 20;

  const placeSlots = (colSlots: BracketSlot[], maxInTrack: number, topOffset: number) =>
    colSlots.map((s, i) => {
      const spacing = colSlots.length > 1 ? (maxInTrack * slotH + (maxInTrack - 1) * 24 - colSlots.length * slotH) / (colSlots.length + 1) : (maxInTrack * slotH + (maxInTrack - 1) * 24 - slotH) / 2;
      const top = topOffset + spacing + i * (slotH + spacing);
      const m = slotMatches.get(s.id) ?? null;
      return { slot: s, top, match: m };
    });

  const hasGrand = finalSlots.length > 0;

  return (
    <div className="overflow-x-auto pb-2">
      <div style={{ minWidth: (totalCols + (hasGrand ? 1 : 0)) * 235, position: 'relative' }}>

        <div style={{ position: 'absolute', left: 8, top: ubBandH / 2 - 8 }} className="text-xs font-bold text-positive">
          {ubLabel}
        </div>
        {hasLB && (
          <div style={{ position: 'absolute', left: 8, top: ubBandH + bandGap + lbBandH / 2 - 8 }} className="text-xs font-bold text-accent">
            {lbLabel}
          </div>
        )}

        <div ref={bracketRef} style={{ height: totalH, position: 'relative', marginLeft: 64 }}>

          {ubCols.map((colSlots, colIdx) => {
            const left = colIdx * (colW + gapX);
            return placeSlots(colSlots, maxUB, 0).map(({ slot, top, match }) => (
              <div key={slot.id} style={{ position: 'absolute', left, top, width: colW }}>
                <SlotCard slot={slot} match={match}
                  teamA={getTeam(resolvedA.get(slot.id))} teamB={getTeam(resolvedB.get(slot.id))}
                  editable={editable} onEdit={() => onEditSlot?.(slot)} onDelete={() => onDeleteSlot?.(slot)} />
              </div>
            ));
          })}

          {hasLB && lbCols.map((colSlots, colIdx) => {
            const left = colIdx * (colW + gapX);
            return placeSlots(colSlots, maxLB, ubBandH + bandGap).map(({ slot, top, match }) => (
              <div key={slot.id} style={{ position: 'absolute', left, top, width: colW }}>
                <SlotCard slot={slot} match={match}
                  teamA={getTeam(resolvedA.get(slot.id))} teamB={getTeam(resolvedB.get(slot.id))}
                  editable={editable} onEdit={() => onEditSlot?.(slot)} onDelete={() => onDeleteSlot?.(slot)} />
              </div>
            ));
          })}

          {hasGrand && finalSlots.map(s => {
            const left = totalCols * (colW + gapX);
            const top = (totalH - slotH) / 2;
            const m = slotMatches.get(s.id) ?? null;
            return (
              <div key={s.id} style={{ position: 'absolute', left, top, width: colW }}>
                <SlotCard slot={s} match={m}
                  teamA={getTeam(resolvedA.get(s.id))} teamB={getTeam(resolvedB.get(s.id))}
                  editable={editable} onEdit={() => onEditSlot?.(s)} onDelete={() => onDeleteSlot?.(s)} />
              </div>
            );
          })}

          <OrthoConnectors slots={slots} containerRef={bracketRef} />
        </div>
      </div>
    </div>
  );
}
