/** Métadonnées des vues publiques, communes au HTML initial et aux transitions. */
export const SEO_VUES = {
  accueil: {
    titre: "Comptes publics, villes et décisions | 500 Signatures",
    description: "500 signatures transforme les chiffres publics et les annonces politiques en dossiers compréhensibles, vérifiés et accessibles à tous.",
    canonique: "/", image: "/carte.png",
  },
  bilan: {
    titre: "Budget et dette publique en France | 500 signatures",
    description: "Recettes, dépenses et dette publiques en France : séries historiques, comparaison européenne et sources vérifiables.",
    canonique: "/bilan/", image: "/bilan/carte.png",
  },
  territoire: {
    titre: "Les comptes de votre ville | 500 Signatures",
    description: "Recherchez une commune pour explorer ses recettes, dépenses, investissements, dette et données publiques, avec les sources officielles.",
    canonique: "/territoire/", image: "/carte.png",
  },
} as const;

/** Aucun envoi réseau. Les états et paramètres saisis ne deviennent pas des métadonnées. */
export function mettreAJourMetadonnees(vue: string, doc: Document = document): void {
  if (!(vue in SEO_VUES)) return;
  const page = SEO_VUES[vue as keyof typeof SEO_VUES];
  const existante = doc.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  const origine = existante ? new URL(existante.href).origin : "https://500signatures.fr";
  doc.title = page.titre;
  const canonique = existante ?? doc.createElement("link");
  canonique.rel = "canonical";
  canonique.href = origine + page.canonique;
  if (!existante) doc.head.append(canonique);
  const valeurs = [
    ["name", "description", page.description],
    ["property", "og:title", page.titre],
    ["property", "og:description", page.description],
    ["property", "og:url", origine + page.canonique],
    ["property", "og:image", origine + page.image],
    ["name", "twitter:title", page.titre],
    ["name", "twitter:description", page.description],
    ["name", "twitter:image", origine + page.image],
  ];
  for (const [attribut, cle, valeur] of valeurs) {
    let meta = doc.querySelector<HTMLMetaElement>(`meta[${attribut}="${cle}"]`);
    if (!meta) { meta = doc.createElement("meta"); meta.setAttribute(attribut!, cle!); doc.head.append(meta); }
    meta.content = valeur!;
  }
}
