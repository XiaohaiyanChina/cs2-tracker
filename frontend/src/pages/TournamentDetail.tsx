import { useParams, Link } from 'react-router-dom';
import { useTournament, useMatches, useTeams } from '../hooks/useData';
import { ChevronLeft, Trophy, Clock, Plus, Save, X, Edit3, Trash2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { isAuthenticated } from '../utils/auth';
import { API_BASE } from '../utils/config';
import { generateDoubleElimBracket } from '../utils/bracket';
import { calcEloChange } from '../utils/elo';
import type { BracketSlot, Match, Team, MatchFormat } from '../types';

function TeamLogo({ team, size = 'md' }: { team: Team | null | undefined; size?: 'sm' | 'md' }) {
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

// --- Bracket Match Card ---
function SlotCard({
  slot, match, teamA, teamB, isAdmin, onEdit, onDelete,
}: {
  slot: BracketSlot;
  match: Match | null;
  teamA: Team | null;
  teamB: Team | null;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const tAWon = match && match.status === 'finished' && match.scoreA > match.scoreB;
  const tBWon = match && match.status === 'finished' && match.scoreB > match.scoreA;

  const bgClass = slot.round === 'grand_final' ? 'border-primary ring-1 ring-primary/20 bg-primary/5' :
    slot.round.startsWith('ub') ? 'border-green-200 bg-green-50/50' :
    'border-amber-200 bg-amber-50/50';

  return (
    <div className={`border-2 rounded-lg ${bgClass} shadow-sm relative group w-[170px]`}
      data-slot-id={slot.id}>
      <div className={`text-center text-[10px] font-semibold py-0.5 rounded-t-md ${
        slot.round.startsWith('ub') ? 'bg-green-100 text-green-700' :
        slot.round.startsWith('lb') ? 'bg-amber-100 text-amber-700' :
        'bg-primary/20 text-primary'
      }`}>
        {slot.label}
      </div>
      <div className="p-2 space-y-1">
        <div className="flex items-center gap-1.5">
          <TeamLogo team={teamA} size="sm" />
          <span className={`text-[11px] font-medium truncate flex-1 ${tAWon ? 'text-gray-900' : 'text-gray-500'}`}>
            {teamA?.name || 'TBD'}
          </span>
          {match && match.status === 'finished' && <span className={`text-xs font-mono font-bold ${tAWon ? 'text-green-600' : 'text-gray-400'}`}>{match.scoreA}</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <TeamLogo team={teamB} size="sm" />
          <span className={`text-[11px] font-medium truncate flex-1 ${tBWon ? 'text-gray-900' : 'text-gray-500'}`}>
            {teamB?.name || 'TBD'}
          </span>
          {match && match.status === 'finished' && <span className={`text-xs font-mono font-bold ${tBWon ? 'text-green-600' : 'text-gray-400'}`}>{match.scoreB}</span>}
        </div>
        {match && (
          <div className="text-[10px] text-gray-400 text-center border-t border-gray-200 pt-1">
            {new Date(match.date).toLocaleDateString('zh-CN')} {new Date(match.date).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
        {!match && (
          <div className="text-[10px] text-gray-300 text-center border-t border-gray-100 pt-1">待定</div>
        )}
      </div>
      {isAdmin && (
        <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button onClick={onEdit} className="p-0.5 bg-white border border-gray-200 rounded hover:bg-gray-50" title="编辑"><Edit3 className="w-3 h-3 text-gray-400" /></button>
          {slot.matchId && <button onClick={onDelete} className="p-0.5 bg-white border border-gray-200 rounded hover:bg-red-50" title="删除"><Trash2 className="w-3 h-3 text-red-400" /></button>}
        </div>
      )}
    </div>
  );
}

// --- SVG Bracket Connectors ---
function BracketConnectors({ slots, containerRef }: { slots: BracketSlot[]; containerRef: React.RefObject<HTMLDivElement | null> }) {
  const [lines, setLines] = useState<{ x1: number; y1: number; x2: number; y2: number; color: string; key: string }[]>([]);

  const calcLines = useCallback(() => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newLines: typeof lines = [];

    slots.forEach(slot => {
      const srcEl = containerRef.current?.querySelector(`[data-slot-id="${slot.id}"]`) as HTMLElement | null;
      if (!srcEl) return;
      const srcRect = srcEl.getBoundingClientRect();
      const srcX = srcRect.right - containerRect.left;
      const srcY = srcRect.top + srcRect.height / 2 - containerRect.top;

      // Win connection (green)
      if (slot.nextWinSlotId) {
        const tgtEl = containerRef.current?.querySelector(`[data-slot-id="${slot.nextWinSlotId}"]`) as HTMLElement | null;
        if (tgtEl) {
          const tgtRect = tgtEl.getBoundingClientRect();
          const tgtX = tgtRect.left - containerRect.left;
          const tgtY = tgtRect.top + tgtRect.height / 2 - containerRect.top;
          newLines.push({ x1: srcX, y1: srcY, x2: tgtX, y2: tgtY, color: '#16a34a', key: `${slot.id}_win` });
        }
      }

      // Lose connection (red)
      if (slot.nextLoseSlotId) {
        const tgtEl = containerRef.current?.querySelector(`[data-slot-id="${slot.nextLoseSlotId}"]`) as HTMLElement | null;
        if (tgtEl) {
          const tgtRect = tgtEl.getBoundingClientRect();
          const tgtX = tgtRect.left - containerRect.left;
          const tgtY = tgtRect.top + tgtRect.height / 2 - containerRect.top;
          newLines.push({ x1: srcX, y1: srcY, x2: tgtX, y2: tgtY, color: '#ef4444', key: `${slot.id}_lose` });
        }
      }
    });

    setLines(newLines);
  }, [slots, containerRef]);

  useEffect(() => {
    calcLines();
    const timer = setTimeout(calcLines, 100); // re-calc after fonts load
    window.addEventListener('resize', calcLines);
    return () => { clearTimeout(timer); window.removeEventListener('resize', calcLines); };
  }, [calcLines]);

  if (lines.length === 0) return null;

  return (
    <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <marker id="arrowWinHead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6 Z" fill="#16a34a" />
        </marker>
        <marker id="arrowLoseHead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6 Z" fill="#ef4444" />
        </marker>
      </defs>
      {lines.map(l => (
        <line key={l.key} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
          stroke={l.color} strokeWidth="2" opacity="0.6"
          markerEnd={l.color === '#16a34a' ? 'url(#arrowWinHead)' : 'url(#arrowLoseHead)'} />
      ))}
    </svg>
  );
}

// --- Main Page ---
export default function TournamentDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: tournament, loading } = useTournament(id || '');
  const { data: allMatches, refresh: refreshMatches } = useMatches();
  const { data: teams, refresh: refreshTeams } = useTeams();
  const isAdmin = isAuthenticated();

  const matches = useMemo(() => (allMatches || []).filter(m => m.tournamentId === id), [allMatches, id]);

  const bracketSlots: BracketSlot[] = useMemo(() => {
    if (!tournament) return [];
    if (tournament.bracketSlots && tournament.bracketSlots.length > 0) return tournament.bracketSlots;
    if (tournament.format === 'double-elim' && tournament.teams.length >= 4) {
      return generateDoubleElimBracket(tournament.id, tournament.teams);
    }
    return [];
  }, [tournament]);

  const slotMatches = useMemo(() => {
    const map = new Map<string, Match | null>();
    bracketSlots.forEach(s => {
      map.set(s.id, s.matchId ? (allMatches?.find(m => m.id === s.matchId) || null) : null);
    });
    return map;
  }, [bracketSlots, allMatches]);

  const resolvedTeamA = useMemo(() => {
    const map = new Map<string, string | null>();
    bracketSlots.forEach(s => {
      if (s.sourceA === 'fixed') { map.set(s.id, s.teamAId); return; }
      if (s.sourceSlotAId) {
        const src = bracketSlots.find(bs => bs.id === s.sourceSlotAId);
        const m = src ? slotMatches.get(src.id) : null;
        map.set(s.id, s.sourceA === 'winner_of' ? getWinner(m) : getLoser(m));
      } else { map.set(s.id, null); }
    });
    return map;
  }, [bracketSlots, slotMatches]);

  const resolvedTeamB = useMemo(() => {
    const map = new Map<string, string | null>();
    bracketSlots.forEach(s => {
      if (s.sourceB === 'fixed') { map.set(s.id, s.teamBId); return; }
      if (s.sourceSlotBId) {
        const src = bracketSlots.find(bs => bs.id === s.sourceSlotBId);
        const m = src ? slotMatches.get(src.id) : null;
        map.set(s.id, s.sourceB === 'winner_of' ? getWinner(m) : getLoser(m));
      } else { map.set(s.id, null); }
    });
    return map;
  }, [bracketSlots, slotMatches]);

  const getTeam = (teamId: string | null | undefined): Team | null =>
    teams?.find(t => t.id === teamId) || null;

  // Admin editing
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ date: '', teamAId: '', teamBId: '', scoreA: '', scoreB: '' });
  const [showNewMatch, setShowNewMatch] = useState(false);
  const [newMatchForm, setNewMatchForm] = useState({ date: '', teamAId: '', teamBId: '', format: 'bo3' as MatchFormat, scoreA: '', scoreB: '' });

  const bracketRef = useRef<HTMLDivElement | null>(null);
  const [, setRefreshKey] = useState(0);

  const saveBracketToTournament = async (slots: BracketSlot[]) => {
    if (!tournament) return;
    await fetch(`${API_BASE}/tournaments/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...tournament, bracketSlots: slots }),
    });
  };

  const startEditSlot = (slot: BracketSlot) => {
    const match = slotMatches.get(slot.id);
    const a = resolvedTeamA.get(slot.id);
    const b = resolvedTeamB.get(slot.id);
    setEditingSlotId(slot.id);
    setEditForm({
      date: match?.date ? new Date(match.date).toISOString().slice(0, 16) : '',
      teamAId: match?.teamAId || a || '',
      teamBId: match?.teamBId || b || '',
      scoreA: match ? String(match.scoreA) : '',
      scoreB: match ? String(match.scoreB) : '',
    });
  };

  const saveSlotMatch = async (slot: BracketSlot) => {
    const now = new Date().toISOString();
    let matchId = slot.matchId;

    if (matchId) {
      const match = allMatches?.find(m => m.id === matchId);
      if (match) {
        const newStatus = (editForm.scoreA || editForm.scoreB) ? 'finished' as const : 'upcoming' as const;
        const updated = { ...match, date: editForm.date || match.date, teamAId: editForm.teamAId || match.teamAId, teamBId: editForm.teamBId || match.teamBId, scoreA: editForm.scoreA ? parseInt(editForm.scoreA) : match.scoreA, scoreB: editForm.scoreB ? parseInt(editForm.scoreB) : match.scoreB, status: newStatus };
        await fetch(`${API_BASE}/matches/${matchId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
        if (newStatus === 'finished' && match.status !== 'finished') {
          const teamA = teams?.find(t => t.id === updated.teamAId);
          const teamB = teams?.find(t => t.id === updated.teamBId);
          if (teamA && teamB) {
            const scoreA = updated.scoreA > updated.scoreB ? 1 : 0;
            const { changeA } = calcEloChange(teamA.elo, teamB.elo, scoreA);
            await fetch(`${API_BASE}/teams/${teamA.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...teamA, elo: teamA.elo + changeA }) });
            await fetch(`${API_BASE}/teams/${teamB.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...teamB, elo: teamB.elo - changeA }) });
            refreshTeams();
          }
        }
      }
    } else {
      matchId = `match_${Date.now()}`;
      const isFinished = !!(editForm.scoreA && editForm.scoreB);
      await fetch(`${API_BASE}/matches`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: matchId, tournamentId: id || '', teamAId: editForm.teamAId, teamBId: editForm.teamBId, scoreA: parseInt(editForm.scoreA) || 0, scoreB: parseInt(editForm.scoreB) || 0, date: editForm.date || now, status: isFinished ? 'finished' : 'upcoming', format: 'bo3', mapIds: [], eloChangeA: 0, eloChangeB: 0 }),
      });
      if (isFinished) {
        const teamA = teams?.find(t => t.id === editForm.teamAId);
        const teamB = teams?.find(t => t.id === editForm.teamBId);
        if (teamA && teamB) {
          const score = parseInt(editForm.scoreA) > parseInt(editForm.scoreB) ? 1 : 0;
          const { changeA } = calcEloChange(teamA.elo, teamB.elo, score);
          await fetch(`${API_BASE}/teams/${teamA.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...teamA, elo: teamA.elo + changeA }) });
          await fetch(`${API_BASE}/teams/${teamB.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...teamB, elo: teamB.elo - changeA }) });
        }
      }
    }

    const updatedSlots = bracketSlots.map(s => s.id === slot.id ? { ...s, matchId } : s);
    await saveBracketToTournament(updatedSlots);
    setEditingSlotId(null);
    refreshMatches();
    refreshTeams();
    setRefreshKey(k => k + 1);
  };

  const deleteSlotMatch = async (slot: BracketSlot) => {
    if (!slot.matchId || !confirm('确定移除此比赛？')) return;
    await fetch(`${API_BASE}/matches/${slot.matchId}`, { method: 'DELETE' });
    const updatedSlots = bracketSlots.map(s => s.id === slot.id ? { ...s, matchId: null } : s);
    await saveBracketToTournament(updatedSlots);
    refreshMatches();
    setRefreshKey(k => k + 1);
  };

  const addMatch = async () => {
    if (!newMatchForm.teamAId || !newMatchForm.teamBId || !newMatchForm.date) return alert('请填写完整信息');
    await fetch(`${API_BASE}/matches`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: `match_${Date.now()}`, tournamentId: id || '', teamAId: newMatchForm.teamAId, teamBId: newMatchForm.teamBId, scoreA: parseInt(newMatchForm.scoreA) || 0, scoreB: parseInt(newMatchForm.scoreB) || 0, date: newMatchForm.date, status: (newMatchForm.scoreA && newMatchForm.scoreB) ? 'finished' as const : 'upcoming' as const, format: newMatchForm.format, mapIds: [], eloChangeA: 0, eloChangeB: 0 }),
    });
    refreshMatches();
    setShowNewMatch(false);
    setNewMatchForm({ date: '', teamAId: '', teamBId: '', format: 'bo3', scoreA: '', scoreB: '' });
  };

  const deleteScheduleMatch = async (matchId: string) => {
    if (!confirm('确定删除此比赛？')) return;
    await fetch(`${API_BASE}/matches/${matchId}`, { method: 'DELETE' });
    const slot = bracketSlots.find(s => s.matchId === matchId);
    if (slot) {
      const updatedSlots = bracketSlots.map(s => s.id === slot.id ? { ...s, matchId: null } : s);
      await saveBracketToTournament(updatedSlots);
    }
    refreshMatches();
    setRefreshKey(k => k + 1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-gray-400">
        <Trophy className="w-16 h-16 mx-auto mb-4 opacity-20" />
        <p className="text-lg">赛事未找到</p>
      </div>
    );
  }

  const statusLabel: Record<string, string> = { upcoming: '即将开始', ongoing: '进行中', finished: '已结束' };
  const formatLabel: Record<string, string> = { 'single-elim': '单败淘汰', 'double-elim': '双败淘汰', 'round-robin': '循环赛', 'groups': '小组赛+淘汰' };

  // Group bracket slots by column for layout
  const col1 = bracketSlots.filter(s => s.round === 'ub_round1');
  const col2Top = bracketSlots.filter(s => s.round === 'ub_final');
  const col2Bot = bracketSlots.filter(s => s.round === 'lb_round1');
  const col3 = bracketSlots.filter(s => s.round === 'lb_final');
  const col4 = bracketSlots.filter(s => s.round === 'grand_final');

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <Link to="/" className="flex items-center gap-1 text-gray-400 hover:text-gray-600 text-sm mb-4 transition-colors">
        <ChevronLeft className="w-4 h-4" /> 返回赛程中心
      </Link>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-2xl font-bold text-gray-900">{tournament.name}</h1>
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                tournament.status === 'ongoing' ? 'bg-green-100 text-green-700' :
                tournament.status === 'upcoming' ? 'bg-blue-100 text-blue-700' :
                'bg-gray-100 text-gray-600'
              }`}>{statusLabel[tournament.status]}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500">{formatLabel[tournament.format]}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <Clock className="w-3.5 h-3.5" /> {tournament.startDate} ~ {tournament.endDate}
              <span>· {tournament.teams?.length || 0} 支战队</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bracket Section */}
      {bracketSlots.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-2">
            <Trophy className="w-5 h-5 text-primary" /> 对阵图
          </h2>
          <p className="text-xs text-gray-400 mb-4">赛制：4支队伍双败淘汰 — 输2场即淘汰，赢2场进总决赛</p>

          <div className="flex items-center gap-4 mb-3 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-6 h-0.5 bg-green-500 rounded inline-block" />
              <ArrowUpRight className="w-3 h-3 text-green-600" /> 胜者晋级
            </span>
            <span className="flex items-center gap-1">
              <span className="w-6 h-0.5 bg-red-400 rounded inline-block" />
              <ArrowDownRight className="w-3 h-3 text-red-500" /> 败者降级
            </span>
          </div>

          <div className="overflow-x-auto pb-2">
            <div style={{ minWidth: 840, position: 'relative' }}>
              {/* Column Headers */}
              <div style={{ display: 'flex', marginBottom: 12, paddingLeft: 0, height: 28 }}>
                <div style={{ width: 170, textAlign: 'center' }}><span className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1">4进2</span></div>
                <div style={{ width: 50 }} />
                <div style={{ width: 170, textAlign: 'center' }}>
                  <div><span className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1">胜者组决赛</span></div>
                  <div style={{ marginTop: 140 }}><span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">败者组第一轮</span></div>
                </div>
                <div style={{ width: 50 }} />
                <div style={{ width: 170, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">败者组决赛</span>
                </div>
                <div style={{ width: 50 }} />
                <div style={{ width: 170, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="text-xs font-bold text-primary bg-primary/10 border border-primary/30 rounded-full px-3 py-1">总决赛</span>
                </div>
              </div>

              {/* Bracket cards container */}
              <div ref={bracketRef} style={{ height: 420, position: 'relative' }}>
                {/* Column 1: UB Round 1 */}
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 170, display: 'flex', flexDirection: 'column', justifyContent: 'space-around' }}>
                  {col1.map(s => {
                    const m = slotMatches.get(s.id) ?? null;
                    return <SlotCard key={s.id} slot={s} match={m} teamA={getTeam(resolvedTeamA.get(s.id))} teamB={getTeam(resolvedTeamB.get(s.id))} isAdmin={isAdmin} onEdit={() => startEditSlot(s)} onDelete={() => deleteSlotMatch(s)} />;
                  })}
                </div>

                {/* Column 2: UB Final (top) + LB R1 (bottom) */}
                <div style={{ position: 'absolute', left: 220, top: 0, bottom: 0, width: 170, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>{col2Top.map(s => {
                    const m = slotMatches.get(s.id) ?? null;
                    return <SlotCard key={s.id} slot={s} match={m} teamA={getTeam(resolvedTeamA.get(s.id))} teamB={getTeam(resolvedTeamB.get(s.id))} isAdmin={isAdmin} onEdit={() => startEditSlot(s)} onDelete={() => deleteSlotMatch(s)} />;
                  })}</div>
                  <div>{col2Bot.map(s => {
                    const m = slotMatches.get(s.id) ?? null;
                    return <SlotCard key={s.id} slot={s} match={m} teamA={getTeam(resolvedTeamA.get(s.id))} teamB={getTeam(resolvedTeamB.get(s.id))} isAdmin={isAdmin} onEdit={() => startEditSlot(s)} onDelete={() => deleteSlotMatch(s)} />;
                  })}</div>
                </div>

                {/* Column 3: LB Final */}
                <div style={{ position: 'absolute', left: 440, top: 0, bottom: 0, width: 170, display: 'flex', alignItems: 'center' }}>
                  {col3.map(s => {
                    const m = slotMatches.get(s.id) ?? null;
                    return <SlotCard key={s.id} slot={s} match={m} teamA={getTeam(resolvedTeamA.get(s.id))} teamB={getTeam(resolvedTeamB.get(s.id))} isAdmin={isAdmin} onEdit={() => startEditSlot(s)} onDelete={() => deleteSlotMatch(s)} />;
                  })}
                </div>

                {/* Column 4: Grand Final + Zones */}
                <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 170, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ position: 'absolute', top: 8, left: 0, right: 0, textAlign: 'center' }}>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 rounded-full px-2.5 py-0.5">
                      <ArrowUpRight className="w-3 h-3" /> 晋级区
                    </span>
                  </div>
                  <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, textAlign: 'center' }}>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-500 bg-red-50 border border-red-200 rounded-full px-2.5 py-0.5">
                      <ArrowDownRight className="w-3 h-3" /> 淘汰区
                    </span>
                  </div>
                  {col4.map(s => {
                    const m = slotMatches.get(s.id) ?? null;
                    return <SlotCard key={s.id} slot={s} match={m} teamA={getTeam(resolvedTeamA.get(s.id))} teamB={getTeam(resolvedTeamB.get(s.id))} isAdmin={isAdmin} onEdit={() => startEditSlot(s)} onDelete={() => deleteSlotMatch(s)} />;
                  })}
                </div>

                {/* SVG Connectors */}
                <BracketConnectors slots={bracketSlots} containerRef={bracketRef} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Slot Modal */}
      {editingSlotId && (() => {
        const slot = bracketSlots.find(s => s.id === editingSlotId);
        if (!slot) return null;
        return (
          <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setEditingSlotId(null)}>
            <div className="bg-white rounded-xl p-6 shadow-xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
              <h3 className="font-semibold text-gray-900 mb-4">编辑 {slot.label}</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">比赛时间</label>
                  <input type="datetime-local" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:border-primary outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">队伍 A</label>
                    <select value={editForm.teamAId} onChange={e => setEditForm({ ...editForm, teamAId: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:border-primary outline-none">
                      <option value="">选择队伍</option>
                      {tournament.teams?.map(tid => { const t = teams?.find(x => x.id === tid); return t ? <option key={tid} value={tid}>{t.name}</option> : null; })}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">队伍 B</label>
                    <select value={editForm.teamBId} onChange={e => setEditForm({ ...editForm, teamBId: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:border-primary outline-none">
                      <option value="">选择队伍</option>
                      {tournament.teams?.map(tid => { const t = teams?.find(x => x.id === tid); return t ? <option key={tid} value={tid}>{t.name}</option> : null; })}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">比分 A</label>
                    <input type="number" min="0" max="3" value={editForm.scoreA} onChange={e => setEditForm({ ...editForm, scoreA: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:border-primary outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">比分 B</label>
                    <input type="number" min="0" max="3" value={editForm.scoreB} onChange={e => setEditForm({ ...editForm, scoreB: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:border-primary outline-none" />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-4 justify-end">
                <button onClick={() => setEditingSlotId(null)} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm"><X className="w-4 h-4 inline mr-1" />取消</button>
                <button onClick={() => saveSlotMatch(slot)} className="px-4 py-2 bg-primary text-white rounded-lg text-sm"><Save className="w-4 h-4 inline mr-1" />保存</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Schedule Section */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" /> 赛程表 ({matches.length})
          </h2>
          {isAdmin && (
            <button onClick={() => setShowNewMatch(!showNewMatch)} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors">
              <Plus className="w-3.5 h-3.5" /> 添加比赛
            </button>
          )}
        </div>

        {showNewMatch && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <input type="datetime-local" value={newMatchForm.date} onChange={e => setNewMatchForm({ ...newMatchForm, date: e.target.value })} className="border border-gray-200 rounded px-3 py-1.5 text-sm" />
              <select value={newMatchForm.teamAId} onChange={e => setNewMatchForm({ ...newMatchForm, teamAId: e.target.value })} className="border border-gray-200 rounded px-3 py-1.5 text-sm">
                <option value="">队伍 A</option>
                {tournament.teams?.map(tid => { const t = teams?.find(x => x.id === tid); return t ? <option key={tid} value={tid}>{t.name}</option> : null; })}
              </select>
              <select value={newMatchForm.teamBId} onChange={e => setNewMatchForm({ ...newMatchForm, teamBId: e.target.value })} className="border border-gray-200 rounded px-3 py-1.5 text-sm">
                <option value="">队伍 B</option>
                {tournament.teams?.map(tid => { const t = teams?.find(x => x.id === tid); return t ? <option key={tid} value={tid}>{t.name}</option> : null; })}
              </select>
              <select value={newMatchForm.format} onChange={e => setNewMatchForm({ ...newMatchForm, format: e.target.value as MatchFormat })} className="border border-gray-200 rounded px-3 py-1.5 text-sm">
                <option value="bo1">BO1</option><option value="bo3">BO3</option><option value="bo5">BO5</option>
              </select>
              <input type="number" min="0" placeholder="比分A" value={newMatchForm.scoreA} onChange={e => setNewMatchForm({ ...newMatchForm, scoreA: e.target.value })} className="border border-gray-200 rounded px-3 py-1.5 text-sm" />
              <input type="number" min="0" placeholder="比分B" value={newMatchForm.scoreB} onChange={e => setNewMatchForm({ ...newMatchForm, scoreB: e.target.value })} className="border border-gray-200 rounded px-3 py-1.5 text-sm" />
            </div>
            <div className="flex gap-2">
              <button onClick={addMatch} className="px-4 py-1.5 bg-primary text-white rounded text-sm">添加</button>
              <button onClick={() => setShowNewMatch(false)} className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded text-sm">取消</button>
            </div>
          </div>
        )}

        {matches.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>队伍 A</th>
                  <th></th>
                  <th>队伍 B</th>
                  <th>比分</th>
                  <th>赛制</th>
                  <th>状态</th>
                  {isAdmin && <th className="w-16"></th>}
                </tr>
              </thead>
              <tbody>
                {matches.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(m => {
                  const teamA = teams?.find(t => t.id === m.teamAId);
                  const teamB = teams?.find(t => t.id === m.teamBId);
                  const slot = bracketSlots.find(s => s.matchId === m.id);
                  return (
                    <tr key={m.id}>
                      <td className="text-sm text-gray-600 whitespace-nowrap">
                        {new Date(m.date).toLocaleDateString('zh-CN')}<br />
                        <span className="text-xs text-gray-400">{new Date(m.date).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                        {slot && <span className="text-[10px] text-primary block">{slot.label}</span>}
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <TeamLogo team={teamA} size="sm" />
                          <span className={`text-sm font-medium ${m.scoreA > m.scoreB ? 'text-gray-900' : 'text-gray-500'}`}>{teamA?.name || 'TBD'}</span>
                        </div>
                      </td>
                      <td className="text-center text-gray-300 text-xs">vs</td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <TeamLogo team={teamB} size="sm" />
                          <span className={`text-sm font-medium ${m.scoreB > m.scoreA ? 'text-gray-900' : 'text-gray-500'}`}>{teamB?.name || 'TBD'}</span>
                        </div>
                      </td>
                      <td className="text-center">
                        <span className={`font-mono font-bold text-sm ${m.status === 'finished' ? 'text-gray-900' : 'text-gray-400'}`}>{m.scoreA}:{m.scoreB}</span>
                      </td>
                      <td className="text-xs text-gray-500 uppercase">{m.format}</td>
                      <td>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          m.status === 'live' ? 'bg-red-500 text-white' :
                          m.status === 'finished' ? 'bg-gray-100 text-gray-600' :
                          'bg-blue-100 text-blue-600'
                        }`}>{m.status === 'live' ? 'LIVE' : m.status === 'finished' ? '已结束' : '预告'}</span>
                      </td>
                      {isAdmin && (
                        <td><button onClick={() => deleteScheduleMatch(m.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button></td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400 text-sm">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" /> 暂无比赛记录
          </div>
        )}
      </div>
    </div>
  );
}
