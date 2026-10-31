/** Les étapes d'une commune choisie dans le récit. Rendu pur ; montants OFGL de la commune. */
import { echapper } from "../texte.ts";
import { SOURCES, type Ville } from "./calculs.ts";
import { fmt, renduEtape, type Etape } from "./rendu.ts";

const m = (n: number) => n / 1e6;
const montant = (n: number) => Math.abs(n) >= 1e9 ? { valeur: n / 1e9, unite: "Md€", d: 2 } : { valeur: m(n), unite: "M€", d: Math.abs(m(n)) < 10 ? 2 : 1 };
const src = (v: Ville, an: string) => `${SOURCES.ofgl.nom}, comptes ${an} de ${v.nom}.`;

export function etapesVille(v: Ville): Etape[] {
  const nom = echapper(v.nom);
  const e: Etape[] = [];
  const r = montant(v.recettes);
  const viz = (x: Record<string, unknown>) => ({ "data-ville": JSON.stringify(x) });
  e.push({
    chapitre: "ville", tableau: "ville", k: 1, titre: `${nom}, <em>ce qui entre</em>.`, lib: `Recettes de fonctionnement · ${v.annee}`, valeur: r.valeur, decimales: r.d, unite: r.unite, ton: "or",
    sous: v.population ? `${fmt(v.recettes / v.population)} € par habitant` : undefined,
    desc: [v.impots && `Impôts et taxes ${fmt(m(v.impots), 1)} M€`, v.dotations && `concours de l’État ${fmt(m(v.dotations), 1)} M€`, v.services && `services ${fmt(m(v.services), 1)} M€`].filter(Boolean).join(" · ") || "Ce que la ville encaisse chaque année pour ses services courants.",
    source: src(v, v.annee), attributs: viz({ mode: "ecart", rec: v.recettes, dep: v.depenses, ouvert: false }),
  });
  const d = montant(v.depenses);
  e.push({
    chapitre: "ville", tableau: "ville", k: 2, titre: `${nom}, <em>ce qui sort</em>.`, lib: `Dépenses de fonctionnement · ${v.annee}`, valeur: d.valeur, decimales: d.d, unite: d.unite,
    sous: v.epargne >= 0 ? `Il reste ${fmt(m(v.epargne), 1)} M€ d’épargne` : `Il manque ${fmt(m(-v.epargne), 1)} M€`, ton: v.epargne >= 0 ? "or" : "argile",
    desc: "Personnel, entretien, subventions, intérêts : les charges courantes de l’année.",
    source: src(v, v.annee), attributs: viz({ mode: "ecart", rec: v.recettes, dep: v.depenses, ouvert: true }),
  });
  if (v.parts) {
    const p = v.parts;
    const morceaux = p.nette !== undefined
      ? [["Fonctionnement", p.fonctionnement, "dep"], ["Remboursement de la dette", p.capital!, "dette"], ["Épargne nette", p.nette, "rec"]]
      : [["Fonctionnement", p.fonctionnement, "dep"], ["Épargne brute", p.brute!, "rec"]];
    const reste = p.nette ?? p.brute ?? 0;
    e.push({
      chapitre: "ville", tableau: "ville", k: 3, titre: "Sur 100 € encaissés <em>par la mairie</em>…", lib: p.nette !== undefined ? `Reste pour investir · ${v.annee}` : `Épargne brute · ${v.annee}`, valeur: reste, decimales: 2, unite: "€",
      sous: `${fmt(p.fonctionnement, 2)} € partent dans le fonctionnement`, ton: reste >= 10 ? "or" : "argile",
      desc: p.nette !== undefined ? "Après le fonctionnement et le remboursement du capital de la dette." : "Avant le remboursement du capital de la dette.",
      source: src(v, v.annee), attributs: viz({ mode: "parts", morceaux }),
    });
  }
  if (v.dette) {
    const s = montant(v.dette.stock);
    const variation = v.dette.precedent !== undefined ? v.dette.stock - v.dette.precedent : undefined;
    e.push({
      chapitre: "ville", tableau: "ville", k: 4, titre: `La dette de <em>${nom}</em>.`, lib: `Encours au 31 décembre ${v.dette.annee}`, valeur: s.valeur, decimales: s.d, unite: s.unite,
      sous: variation === undefined ? undefined : variation > 0 ? `+${fmt(m(variation), 1)} M€ en un an` : variation < 0 ? `−${fmt(m(-variation), 1)} M€ en un an` : "Stable sur un an", ton: variation !== undefined && variation > 0 ? "argile" : "or",
      desc: v.epargne > 0 ? `Soit ${fmt(v.dette.stock / v.epargne, 1)} années d’épargne brute pour tout rembourser.` : "Capital restant à rembourser.",
      source: src(v, v.dette.annee), attributs: viz({ mode: "dette", stock: v.dette.stock, emprunts: v.dette.emprunts, remboursements: v.dette.remboursements }),
    });
  }
  if (v.investissement) {
    const i = montant(v.investissement.montant);
    e.push({
      chapitre: "ville", tableau: "ville", k: 5, titre: "Ce que la ville <em>construit</em>.", lib: `Investissement · ${v.investissement.annee}`, valeur: i.valeur, decimales: i.d, unite: i.unite, ton: "or",
      sous: v.population ? `${fmt(v.investissement.montant / v.population)} € par habitant` : undefined,
      desc: "Écoles, voirie, équipements : dépenses d’investissement hors remboursement de la dette.",
      source: src(v, v.investissement.annee), attributs: viz({ mode: "invest", montant: v.investissement.montant, recettes: v.recettes }),
      contenu: `<a class="etape__lien" href="#ville" data-autre-ville>Choisir une autre ville</a>`,
    });
  }
  return e;
}

export function renduVille(v: Ville, depart: number): string {
  return etapesVille(v).map((x, i) => renduEtape(x, depart + i)).join("");
}
