const K_FACTOR = 32;

export function expectedScore(eloA: number, eloB: number): number {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

export function calcEloChange(eloA: number, eloB: number, scoreA: number): { changeA: number; changeB: number } {
  const expectedA = expectedScore(eloA, eloB);
  const changeA = Math.round(K_FACTOR * (scoreA - expectedA));
  return { changeA, changeB: -changeA };
}

export function initialElo(): number {
  return 1000;
}
