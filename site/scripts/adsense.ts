/**
 * Optional AdSense verification wiring.
 *
 * The publisher id is deliberately supplied by the deployment environment:
 * it is account-specific and must never be guessed or committed as a fake
 * value. With no id, the build remains ad-free. With a valid id, the standard
 * verification meta tag is added to generated editorial documents and ads.txt
 * is written alongside the site output. Verification never loads an ad SDK;
 * actual serving requires a separate consent-aware adapter and configured CMP.
 */

const IDENTIFIANT = /^ca-pub-\d{16}$/;
const ADS_TXT_ID = "f08c47fec0942fa0";

export function identifiantAdsense(raw: string | undefined): string | null {
  const valeur = raw?.trim() ?? "";
  if (!valeur) return null;
  if (!IDENTIFIANT.test(valeur)) {
    throw new Error(
      `ADSENSE_PUBLISHER_ID doit être un identifiant AdSense du type « ca-pub-1234567890123456 », reçu « ${valeur} ».`,
    );
  }
  return valeur;
}

export function codeAdsense(id: string): string {
  if (!IDENTIFIANT.test(id)) throw new Error(`Identifiant AdSense invalide : « ${id} ».`);
  return `<meta name="google-adsense-account" content="${id}">`;
}

export function injecterAdsense(shell: string, rawId: string | undefined): string {
  if (/<script\b[^>]*\bsrc=["'][^"']*adsbygoogle\.js/i.test(shell)) {
    throw new Error("Un SDK publicitaire est chargé avant consentement dans le gabarit AdSense.");
  }
  const id = identifiantAdsense(rawId);
  if (!id) return shell;
  if (!shell.includes("</head>")) throw new Error("Le document AdSense ne porte pas de fermeture </head>.");
  const existing = shell.match(/<meta\s+name="google-adsense-account"\s+content="([^"]+)"\s*\/?\s*>/);
  if (existing) {
    if (existing[1] !== id) throw new Error("La balise de vérification AdSense diffère de l'identifiant configuré.");
    return shell;
  }
  return shell.replace("</head>", `  ${codeAdsense(id)}\n  </head>`);
}

export function contenuAdsTxt(rawId: string | undefined): string | null {
  const id = identifiantAdsense(rawId);
  return id ? `google.com, ${id.slice("ca-".length)}, DIRECT, ${ADS_TXT_ID}\n` : null;
}
