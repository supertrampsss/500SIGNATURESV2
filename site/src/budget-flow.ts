import type { BudgetComparisonRow } from './budget-comparison.ts';
import { echapper } from './texte.ts';

const WIDTH = 696;
const SOURCE_WIDTH = 154;
const COLLECTOR_RIGHT = 450;
const MAXIMUM_THICKNESS = 100;

export type BudgetFlowRow = {
  label: string;
  budget: number;
  retirement: number;
  remaining: number;
  estimated: boolean;
  budgetHeight: number;
  retirementHeight: number;
  remainingHeight: number;
  top: number;
  retirementTop: number;
  collectorLeft: number;
  collectorRight: number;
  collectedHeight: number;
};

/** One euro scale for every ribbon, including the sum entering the retirement node.
 * Source boxes and the total's label are annotations; their size does not encode money.
 */
export function buildBudgetFlowModel(rows: readonly BudgetComparisonRow[]) {
  if (rows.length === 0) throw new RangeError('Le flux budgétaire nécessite au moins un ministère.');
  for (const row of rows) {
    if (!Number.isFinite(row.budget) || row.budget <= 0 || row.retirement === null
      || !Number.isFinite(row.retirement) || row.retirement < 0 || row.retirement > row.budget) {
      throw new RangeError(`Montants du flux budgétaire invalides : ${row.label}`);
    }
  }
  const maximum = Math.max(...rows.map(row => row.budget));
  const euroScale = MAXIMUM_THICKNESS / maximum;
  const totalBudget = rows.reduce((sum, row) => sum + row.budget, 0);
  const totalRetirement = rows.reduce((sum, row) => sum + row.retirement!, 0);
  if (!Number.isFinite(totalBudget) || !Number.isFinite(totalRetirement)) {
    throw new RangeError('Total du flux budgétaire invalide.');
  }
  const collectorWidth = totalRetirement * euroScale;
  // Distribute individual branches side by side, in the same order as their sources.
  let collected = 0;
  const lanes: BudgetFlowRow[] = rows.map((row, index) => {
    const retirement = row.retirement!;
    const remaining = row.budget - retirement;
    const budgetHeight = row.budget * euroScale;
    const remainingHeight = remaining * euroScale;
    const retirementHeight = retirement * euroScale;
    const top = 104 + index * 145 - budgetHeight / 2;
    const collectorLeft = COLLECTOR_RIGHT - collectorWidth + collected * euroScale;
    collected += retirement;
    return {
      label: row.label, budget: row.budget, retirement, remaining, estimated: !!row.estimated,
      budgetHeight, retirementHeight, remainingHeight, top, retirementTop: top + remainingHeight,
      collectorLeft, collectorRight: COLLECTOR_RIGHT - collectorWidth + collected * euroScale,
      collectedHeight: collected * euroScale,
    };
  });
  const nodeTop = Math.max(104 + (rows.length - 1) * 145 + 116,
    ...lanes.map(row => row.retirementTop + Math.max(80, row.retirementHeight + 24) + 24));
  return { rows: lanes, euroScale, maximum, totalBudget, totalRetirement,
    totalRemaining: totalBudget - totalRetirement, collectorWidth, nodeTop,
    width: WIDTH, height: nodeTop + 116, estimated: lanes.some(row => row.estimated) };
}

function milliards(euros: number): string {
  if (euros === 0) return '0';
  const value = euros / 1e9;
  const digits = value >= 1 ? 1 : value >= .1 ? 2 : value >= .01 ? 3 : 4;
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

function amount(euros: number, estimated = false): string {
  return `${estimated ? '≈ ' : ''}${milliards(euros)} Md€`;
}

function scope(count: number): string {
  return count === 3 ? 'sur ces trois ministères' : count === 1 ? 'sur ce ministère' : `sur ces ${count} ministères`;
}

function sourceLines(label: string): string[] {
  const lines: string[] = [];
  for (const word of label.split(/\s+/)) {
    if (lines.length && `${lines.at(-1)} ${word}`.length <= 18) lines[lines.length - 1] += ` ${word}`;
    else lines.push(word);
  }
  return lines;
}

function attributes(row: BudgetFlowRow): string {
  return `data-budget-eur="${row.budget}" data-retirement-eur="${row.retirement}" data-remaining-eur="${row.remaining}"`;
}

/** A horizontal ribbon bending down into its own exact share of the collector. */
function retirementPath(row: BudgetFlowRow, endY: number): string {
  const y = row.retirementTop;
  const thickness = row.retirementHeight;
  const radius = Math.max(80, thickness + 24);
  const bend = row.collectorRight - radius;
  return `M${SOURCE_WIDTH},${y} H${bend} Q${row.collectorRight},${y} ${row.collectorRight},${y + radius} V${endY} H${row.collectorLeft} V${y + radius} Q${row.collectorLeft},${y + thickness} ${bend},${y + thickness} H${SOURCE_WIDTH} Z`;
}

function desktop(model: ReturnType<typeof buildBudgetFlowModel>): string {
  const redPaths = model.rows.filter(row => row.retirement > 0).map(row =>
    `<path class="budget-flow__retirement-path" d="${retirementPath(row, model.nodeTop - 12)}"/>`).join('');
  const lanes = model.rows.map(row => {
    const center = row.top + row.budgetHeight / 2;
    const lines = sourceLines(row.label);
    const nameY = center - 29 - (lines.length - 1) * 9;
    const sourceName = lines.map((line, index) => `<tspan x="12" y="${nameY + index * 20}">${echapper(line)}</tspan>`).join('');
    const afterY = row.top + row.remainingHeight / 2;
    // The white outline makes crossings explicit: navy ribbons never join each other.
    const navy = row.remaining > 0 ? `<path class="budget-flow__remaining-path" d="M${SOURCE_WIDTH},${row.top} H681 L695,${afterY} L681,${row.top + row.remainingHeight} H${SOURCE_WIDTH} Z"/><text class="budget-flow__after-value" x="670" y="${afterY}" dominant-baseline="central" text-anchor="end">${amount(row.remaining, row.estimated)}</text>` : `<text class="budget-flow__zero-value" x="670" y="${afterY}" dominant-baseline="central" text-anchor="end">${amount(0, row.estimated)}</text>`;
    const redLabel = row.retirementTop + row.retirementHeight + 23;
    return `<g class="budget-flow__row" ${attributes(row)}>${navy}
      <rect class="budget-flow__source" x="0" y="${center - 56}" width="${SOURCE_WIDTH}" height="112" rx="5"/>
      <text class="budget-flow__source-name">${sourceName}</text>
      <text class="budget-flow__source-value" x="12" y="${center + 30}">${milliards(row.budget)}<tspan class="budget-flow__source-unit"> Md€</tspan></text>
      <text class="budget-flow__branch-value" x="237" y="${redLabel}" text-anchor="middle">${amount(row.retirement, row.estimated)}</text>
    </g>`;
  }).join('');
  const collectorCenter = COLLECTOR_RIGHT - model.collectorWidth / 2;
  const arrow = model.collectorWidth > 0 ? `<path class="budget-flow__retirement-path" d="M${collectorCenter - model.collectorWidth / 2 - 8},${model.nodeTop - 15} H${collectorCenter + model.collectorWidth / 2 + 8} L${collectorCenter},${model.nodeTop} Z"/>` : '';
  return `<div class="budget-flow__desktop" aria-hidden="true"><svg viewBox="0 0 ${model.width} ${model.height}" xmlns="http://www.w3.org/2000/svg" focusable="false">
    <text class="budget-flow__column-label" x="12" y="25">Budget prévu</text>
    <text class="budget-flow__column-label" x="692" y="25" text-anchor="end">Après reclassement</text>
    ${redPaths}${lanes}${arrow}
    <rect class="budget-flow__total-node" x="${collectorCenter - 125}" y="${model.nodeTop}" width="250" height="110" rx="7"/>
    <text class="budget-flow__total-title" x="${collectorCenter}" y="${model.nodeTop + 31}" text-anchor="middle">Retraites</text>
    <text class="budget-flow__retirement-total" x="${collectorCenter}" y="${model.nodeTop + 68}" text-anchor="middle">${amount(model.totalRetirement, model.estimated)}</text>
    <text class="budget-flow__total-scope" x="${collectorCenter}" y="${model.nodeTop + 94}" text-anchor="middle">${scope(model.rows.length)}</text>
  </svg></div>`;
}

function mobile(model: ReturnType<typeof buildBudgetFlowModel>): string {
  const lanes = model.rows.map(row => {
    const previous = row.collectedHeight - row.retirementHeight;
    return `<li class="budget-flow__row budget-flow__mobile-row" ${attributes(row)} style="--budget-height:${row.budgetHeight}px;--remaining-height:${row.remainingHeight}px;--retirement-height:${row.retirementHeight}px;--collector-before:${previous}px;--collector-after:${row.collectedHeight}px">
      <span class="budget-flow__mobile-collector-before"></span><span class="budget-flow__mobile-collector-after"></span>
      <strong class="budget-flow__mobile-name">${echapper(row.label)}</strong>
      <span class="budget-flow__mobile-budget-label">Budget prévu</span>
      <span class="budget-flow__mobile-budget">${milliards(row.budget)}<small> Md€</small></span>
      <span class="budget-flow__mobile-after-label">Après reclassement</span>
      <span class="budget-flow__mobile-remaining${row.remaining === 0 ? ' budget-flow__mobile-remaining--zero' : ''}">${amount(row.remaining, row.estimated)}</span>
      <span class="budget-flow__mobile-retirement"></span>
      <span class="budget-flow__mobile-branch-value">${amount(row.retirement, row.estimated)}<small>vers les retraites</small></span>
    </li>`;
  }).join('');
  return `<div class="budget-flow__mobile" aria-hidden="true"><ol class="budget-flow__mobile-lanes">${lanes}</ol>
    <div class="budget-flow__mobile-total"><span>Retraites</span><strong class="budget-flow__retirement-total">${amount(model.totalRetirement, model.estimated)}</strong><small>${scope(model.rows.length)}</small></div>
  </div>`;
}

/** Focus chart: pass only ministries whose retirement amount is known. */
export function budgetFlow(rows: readonly BudgetComparisonRow[]): string {
  const model = buildBudgetFlowModel(rows);
  const summary = `${rows.length} ${rows.length === 1 ? 'ministère' : 'ministères'}. ${model.rows.map(row => `${row.label} : budget prévu ${amount(row.budget)}, retraites ${amount(row.retirement, row.estimated)}, après reclassement ${amount(row.remaining, row.estimated)}.`).join(' ')} Total retraites ${amount(model.totalRetirement, model.estimated)}, ${scope(rows.length)}. Reclassement à total inchangé.`;
  return `<figure class="budget-flow" role="img" aria-label="${echapper(summary)}" data-total-retirement-eur="${model.totalRetirement}">
    ${desktop(model)}${mobile(model)}
    <figcaption class="budget-flow__legend">Épaisseur des flux : même échelle en euros. Reclassement à total inchangé.${model.estimated ? '<br>≈ : estimation des retraites et du montant après reclassement.' : ''}</figcaption>
  </figure>`;
}
