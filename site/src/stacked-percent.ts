import { echapper } from "./texte.ts";

export type StackedPercentRow = { label: string; value: number };
export type StackedPercentComposition = { partLabel: string; remainderLabel: string };

/** Proportions lues sur un graphique publié : aucune conversion en euros. */
export function stackedPercent(rows: readonly StackedPercentRow[], composition: StackedPercentComposition): string {
  if (rows.some(row => !Number.isFinite(row.value) || row.value < 0 || row.value > 100)) {
    throw new RangeError("Les proportions doivent être comprises entre 0 et 100.");
  }
  const approx = (value: number) => value > 0 && value < 1 ? "moins de 1 %" : `environ ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value)} %`;
  return `<div class="stacked-percent"><ul class="stacked-percent__legend"><li class="stacked-percent__key stacked-percent__key--part">${echapper(composition.partLabel)}</li><li class="stacked-percent__key stacked-percent__key--rest">${echapper(composition.remainderLabel)}</li></ul><ol class="stacked-percent__rows">${rows.map(row => `<li class="stacked-percent__row"><span class="stacked-percent__label">${echapper(row.label)}</span><span class="stacked-percent__bar" role="img" aria-label="${echapper(row.label)} : ${echapper(composition.partLabel)}, ${approx(row.value)} ; ${echapper(composition.remainderLabel)}, ${approx(100 - row.value)}"><span class="stacked-percent__part" style="width:${row.value}%"></span><span class="stacked-percent__rest" style="width:${100 - row.value}%"></span></span></li>`).join("")}</ol><div class="stacked-percent__axis" aria-hidden="true">${[0,25,50,75,100].map(value => `<span>${value} %</span>`).join("")}</div></div>`;
}
