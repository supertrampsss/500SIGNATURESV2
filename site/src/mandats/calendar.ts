import type { Game, Mode } from './types.ts';
export const YEAR_SLOTS: Record<Mode, readonly number[]> = { municipal: [8,8,8,7,7,7], national: [9,9,9,9,9] };
export function calendarFor(g: Pick<Game,'version'|'mode'|'turn'>) {
  const slots = g.version === 3 ? YEAR_SLOTS[g.mode] : Array(g.mode === 'municipal' ? 6 : 5).fill(1) as number[];
  let start=0, completedYears=0;
  for (let i=0;i<slots.length;i++) {
    const end=start+slots[i];
    if(g.turn>=end)completedYears++;
    if(g.turn<end || i===slots.length-1)return {year:i+1,years:slots.length,slot:Math.min(g.turn-start+1,slots[i]),slots:slots[i],completedYears,isYearEnd:g.turn<end && g.turn===end-1};
    start=end;
  }
  throw new Error('Calendrier invalide.');
}
