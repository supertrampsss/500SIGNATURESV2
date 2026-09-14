/**
 * Optional AdSense verification wiring.
 *
 * The publisher id is deliberately supplied by the deployment environment:
 * it is account-specific and must never be guessed or committed as a fake
 * value. With no id, the build remains ad-free. With a valid id, the standard
 * verification script is added to generated editorial documents and ads.txt is
 * written alongside the site output.
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
  return `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${id}" crossorigin="anonymous"></script>`;
}

export function injecterAdsense(shell: string, rawId: string | undefined): string {
  const id = identifiantAdsense(rawId);
  if (!id) return shell;
  if (!shell.includes("</head>")) throw new Error("Le document AdSense ne porte pas de fermeture </head>.");
  if (shell.includes("adsbygoogle.js?client=")) return shell;
  return shell.replace("</head>", `  ${codeAdsense(id)}\n  </head>`);
}

export function contenuAdsTxt(rawId: string | undefined): string | null {
  const id = identifiantAdsense(rawId);
  return id ? `google.com, ${id.slice("ca-".length)}, DIRECT, ${ADS_TXT_ID}\n` : null;
}
