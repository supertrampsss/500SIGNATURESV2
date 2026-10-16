import type { PressureFront, PressureProgramme } from './pressure-types.ts';
import type { PressureDossierContent } from './pressure-content.ts';

/** V15 scenario assumptions, not observed recruitment or French repair costs.
 * A four-period surge targets up to six periods of the current service's work.
 * It covers the latest shortfall and a quarter of that retained backlog per
 * period. Finite teams add at most 12 capacity units. Larger packages need two
 * or three preparation periods and one to three shared execution units each.
 * Mobilisation costs 35% of comparable permanent investment per capacity unit;
 * temporary operating costs 150% of the ordinary relief's unit cost. Actual
 * throughput still depends on fatigue, incidents, links and future demand.
 */
export function pressureRecoveryPlan(front: PressureFront, content: PressureDossierContent) {
  const round = (value: number) => Math.round(value * 1000) / 1000;
  const backlog = Math.min(front.backlog, front.capacity * 6);
  const shortfall = Math.max(0, (front.incomingNeed ?? front.need) - front.effectiveCapacity);
  const capacity = round(Math.min(12, Math.max(content.relief.capacity, backlog / 4 + shortfall)));
  const implementation = Math.min(3, Math.max(1, Math.ceil(backlog / (front.capacity * 2))));
  const delay = backlog > front.capacity * 3 ? 3 : 2;
  return {
    backlog: round(backlog), capacity, implementation, delay, duration: 4,
    investment: round(content.programme.investment * capacity / content.programme.capacity * .35),
    operating: round(content.relief.operating * capacity / content.relief.capacity * 1.5),
  };
}

/** A financed or operating surge cannot be sold for a second time. */
export function isPressureRecovery(programme: PressureProgramme): boolean {
  return programme.sourceChoice.endsWith(`-pressure-${programme.sector}-recovery`);
}
