import type { BracketSlot, BracketType } from '../types';

export function generateBracket(type: BracketType, tournamentId: string, teamIds: string[]): BracketSlot[] {
  switch (type) {
    case '4_single': return generate4Single(tournamentId, teamIds);
    case '4_double': return generate4Double(tournamentId, teamIds);
    case '8_single': return generate8Single(tournamentId, teamIds);
    default: return [];
  }
}

function pfx(tournamentId: string) { return `slot_${tournamentId}`; }

function generate4Single(tournamentId: string, teamIds: string[]): BracketSlot[] {
  const p = pfx(tournamentId);
  return [
    {
      id: `${p}_semi_0`, round: 'ub_semi', label: '半决赛',
      matchId: null, teamAId: teamIds[0] || null, teamBId: teamIds[1] || null,
      nextWinSlotId: `${p}_final`, nextLoseSlotId: null,
      sourceA: 'fixed', sourceB: 'fixed', sourceSlotAId: null, sourceSlotBId: null,
    },
    {
      id: `${p}_semi_1`, round: 'ub_semi', label: '半决赛',
      matchId: null, teamAId: teamIds[2] || null, teamBId: teamIds[3] || null,
      nextWinSlotId: `${p}_final`, nextLoseSlotId: null,
      sourceA: 'fixed', sourceB: 'fixed', sourceSlotAId: null, sourceSlotBId: null,
    },
    {
      id: `${p}_final`, round: 'ub_final', label: '决赛',
      matchId: null, teamAId: null, teamBId: null,
      nextWinSlotId: null, nextLoseSlotId: null,
      sourceA: 'winner_of', sourceB: 'winner_of',
      sourceSlotAId: `${p}_semi_0`, sourceSlotBId: `${p}_semi_1`,
    },
  ];
}

function generate4Double(tournamentId: string, teamIds: string[]): BracketSlot[] {
  const p = pfx(tournamentId);
  return [
    {
      id: `${p}_ub_semi_0`, round: 'ub_semi', label: '胜者组半决赛',
      matchId: null, teamAId: teamIds[0] || null, teamBId: teamIds[1] || null,
      nextWinSlotId: `${p}_ub_final`, nextLoseSlotId: `${p}_lb_r1`,
      sourceA: 'fixed', sourceB: 'fixed', sourceSlotAId: null, sourceSlotBId: null,
    },
    {
      id: `${p}_ub_semi_1`, round: 'ub_semi', label: '胜者组半决赛',
      matchId: null, teamAId: teamIds[2] || null, teamBId: teamIds[3] || null,
      nextWinSlotId: `${p}_ub_final`, nextLoseSlotId: `${p}_lb_r1`,
      sourceA: 'fixed', sourceB: 'fixed', sourceSlotAId: null, sourceSlotBId: null,
    },
    {
      id: `${p}_ub_final`, round: 'ub_final', label: '胜者组决赛',
      matchId: null, teamAId: null, teamBId: null,
      nextWinSlotId: `${p}_grand_final`, nextLoseSlotId: `${p}_lb_final`,
      sourceA: 'winner_of', sourceB: 'winner_of',
      sourceSlotAId: `${p}_ub_semi_0`, sourceSlotBId: `${p}_ub_semi_1`,
    },
    {
      id: `${p}_lb_r1`, round: 'lb_round1', label: '败者组第一轮',
      matchId: null, teamAId: null, teamBId: null,
      nextWinSlotId: `${p}_lb_final`, nextLoseSlotId: null,
      sourceA: 'loser_of', sourceB: 'loser_of',
      sourceSlotAId: `${p}_ub_semi_0`, sourceSlotBId: `${p}_ub_semi_1`,
    },
    {
      id: `${p}_lb_final`, round: 'lb_final', label: '败者组决赛',
      matchId: null, teamAId: null, teamBId: null,
      nextWinSlotId: `${p}_grand_final`, nextLoseSlotId: null,
      sourceA: 'loser_of', sourceB: 'winner_of',
      sourceSlotAId: `${p}_ub_final`, sourceSlotBId: `${p}_lb_r1`,
    },
    {
      id: `${p}_grand_final`, round: 'grand_final', label: '总决赛',
      matchId: null, teamAId: null, teamBId: null,
      nextWinSlotId: null, nextLoseSlotId: null,
      sourceA: 'winner_of', sourceB: 'winner_of',
      sourceSlotAId: `${p}_ub_final`, sourceSlotBId: `${p}_lb_final`,
    },
  ];
}

function generate8Single(tournamentId: string, teamIds: string[]): BracketSlot[] {
  const p = pfx(tournamentId);
  return [
    {
      id: `${p}_qf_0`, round: 'ub_quarter', label: '1/4决赛',
      matchId: null, teamAId: teamIds[0] || null, teamBId: teamIds[1] || null,
      nextWinSlotId: `${p}_semi_0`, nextLoseSlotId: null,
      sourceA: 'fixed', sourceB: 'fixed', sourceSlotAId: null, sourceSlotBId: null,
    },
    {
      id: `${p}_qf_1`, round: 'ub_quarter', label: '1/4决赛',
      matchId: null, teamAId: teamIds[2] || null, teamBId: teamIds[3] || null,
      nextWinSlotId: `${p}_semi_0`, nextLoseSlotId: null,
      sourceA: 'fixed', sourceB: 'fixed', sourceSlotAId: null, sourceSlotBId: null,
    },
    {
      id: `${p}_qf_2`, round: 'ub_quarter', label: '1/4决赛',
      matchId: null, teamAId: teamIds[4] || null, teamBId: teamIds[5] || null,
      nextWinSlotId: `${p}_semi_1`, nextLoseSlotId: null,
      sourceA: 'fixed', sourceB: 'fixed', sourceSlotAId: null, sourceSlotBId: null,
    },
    {
      id: `${p}_qf_3`, round: 'ub_quarter', label: '1/4决赛',
      matchId: null, teamAId: teamIds[6] || null, teamBId: teamIds[7] || null,
      nextWinSlotId: `${p}_semi_1`, nextLoseSlotId: null,
      sourceA: 'fixed', sourceB: 'fixed', sourceSlotAId: null, sourceSlotBId: null,
    },
    {
      id: `${p}_semi_0`, round: 'ub_semi', label: '半决赛',
      matchId: null, teamAId: null, teamBId: null,
      nextWinSlotId: `${p}_final`, nextLoseSlotId: null,
      sourceA: 'winner_of', sourceB: 'winner_of',
      sourceSlotAId: `${p}_qf_0`, sourceSlotBId: `${p}_qf_1`,
    },
    {
      id: `${p}_semi_1`, round: 'ub_semi', label: '半决赛',
      matchId: null, teamAId: null, teamBId: null,
      nextWinSlotId: `${p}_final`, nextLoseSlotId: null,
      sourceA: 'winner_of', sourceB: 'winner_of',
      sourceSlotAId: `${p}_qf_2`, sourceSlotBId: `${p}_qf_3`,
    },
    {
      id: `${p}_final`, round: 'ub_final', label: '决赛',
      matchId: null, teamAId: null, teamBId: null,
      nextWinSlotId: null, nextLoseSlotId: null,
      sourceA: 'winner_of', sourceB: 'winner_of',
      sourceSlotAId: `${p}_semi_0`, sourceSlotBId: `${p}_semi_1`,
    },
  ];
}
