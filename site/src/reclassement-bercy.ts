/** Direction du Budget, annexe pensions PLF 2027, pages 11–12.
 * Crédits des DEUX ministères détaillés par le rapport, en euros.
 * Les retenues salariales sont déjà dans les crédits bruts : on les déplace,
 * on ne les ajoute pas. Ce pont budgétaire ne modifie aucune série COFOG.
 */
export const SOURCE_RECLASSEMENT_BERCY = 'https://www.budget.gouv.fr/documentation/file-download/34465';
export function reclassementBercy() {
  const ministeres = [
    { nom: 'Éducation nationale', brut: 89.1e9, employeur: 25.1e9, salariales: 3.4e9 },
    { nom: 'Intérieur', brut: 34.2e9, employeur: 9.3e9, salariales: 1.1e9 },
  ].map(m => ({ ...m, retraites: m.employeur + m.salariales, horsRetraites: m.brut - m.employeur - m.salariales }));
  return { annee: '2027', statut: 'PLF', ministeres,
    retraites: ministeres.reduce((s, m) => s + m.retraites, 0),
    total: ministeres.reduce((s, m) => s + m.brut, 0) };
}

/** Une seule ligne Retraites ; la somme des sorties égale les crédits initiaux. */
export function renduReclassementBercy(): string {
  const r = reclassementBercy();
  const md = (v: number) => new Intl.NumberFormat('fr-FR', {minimumFractionDigits: 1, maximumFractionDigits: 1}).format(v / 1e9);
  const lignes = [...r.ministeres.map(m => ({ nom: m.nom + ' hors retraites', valeur: m.horsRetraites })), { nom: 'Retraites', valeur: r.retraites }];
  return `<section class="bercy-reclassement" id="reclassement-bercy" aria-labelledby="bercy-titre">
    <h2 id="bercy-titre">Les budgets des ministères, retraites à part</h2>
    <p>PLF 2027 · Deux ministères détaillés par Bercy · En milliards d’euros</p>
    <p>À l’Éducation nationale, 28,5 Md€ sur 89,1 financent les retraites ; il reste 60,6 Md€ hors retraites. À l’Intérieur, 10,4 Md€ sont retirés des 34,2 Md€ initiaux. Nous réunissons ces versements dans une seule ligne « Retraites ».</p>
    <div class="bercy-reclassement__bar" role="img" aria-label="Sur 123,3 milliards : Éducation nationale hors retraites 60,6 ; Intérieur hors retraites 23,8 ; Retraites 38,9.">${lignes.map((l, i) => `<span class="bercy-reclassement__segment bercy-reclassement__segment--${i}" style="flex:${l.valeur}"></span>`).join('')}</div>
    <table><caption>Répartition après reclassement des deux ministères</caption><thead><tr><th scope="col">Destination</th><th scope="col">Md€</th></tr></thead><tbody>${lignes.map(l => `<tr><th scope="row">${l.nom}</th><td>${md(l.valeur)}</td></tr>`).join('')}<tr><th scope="row">Total inchangé</th><td>${md(r.total)}</td></tr></tbody></table>
    <p>60,6 + 23,8 + 38,9 = 123,3 Md€. Les retraites comprennent ici les contributions employeur et les cotisations salariales versées au CAS Pensions. Ce sous-total couvre ces deux ministères ; il ne représente pas toutes les retraites françaises. Les transferts des opérateurs non détaillés par Bercy restent hors de ce reclassement.</p>
    <p><a href="${SOURCE_RECLASSEMENT_BERCY}#page=11">Direction du Budget, annexe pensions au PLF 2027, pages 11–12</a> · <a href="/analyses/financement-retraites-publiques/">Lire le dossier</a></p>
  </section>`;
}
