# Task 8 — Verdict, revanche et événements

## RED / GREEN

- RED : ajout des tests de hiérarchie du verdict, de bilan structuré, de revanche déterministe et du canal d’événements. Ils échouaient d’abord par absence de `tunnel-evenements.ts`, `bilanVerdict()` et `nouvelleContrainte()`.
- GREEN : bilan et rendu expliquent le mandat avant les CTA ; le profil est descriptif ; la revanche est déterministe ; les événements sont émis dans le contrôleur.
- RED : le test BFCache pendant le retour constatait que la sauvegarde restait en `conseil` après `pageshow`.
- GREEN : le tampon en attente est conservé hors animation, résolu une seule fois au retour, sauvegardé puis peint. Le test vérifie aussi qu’aucun événement décision/fin n’est doublé lors d’un second `pageshow`.

## Fonctionnel

- `bilanVerdict()` retourne trouvé, reste, soutiens, engagements avec statut `tenue` / `impossibilite_detectee`, crises, reports, trois gestes par effet absolu et profil.
- Verdict : section « Votre mandat », promesses et conséquences, historique natif `<details>` et CTA « Relever le défi » avant le partage.
- Revanche : ajoute dans cet ordre `sans-impot`, `sans-prestation`, `ecole-sante`, `sans-collectivites`; lorsque les quatre sont déjà présents, conserve les engagements et incrémente la graine uint32 avec retour à zéro sûr.
- Partage : Web Share en premier, puis presse-papiers et invite de secours ; une seule émission `partage` à l’action.
- Événements : union stricte `EvenementTunnel`, dispatch local `simulateur:evenement`, sans identifiant de mesure, historique de choix ni donnée utilisateur.

## Correctif BFCache

`pagehide.persisted` annule toujours l’animation, mais laisse le tampon dans `tamponEnRetour`. Au premier `pageshow.persisted`, `resoudreRetour()` exécute le resolver post-tampon une fois, écrit l’état puis peint. Un retour déjà résolu ne fait que repeindre ; ni télex, ni crise, ni décision ne sont rejoués ou dupliqués.

## Vérifications

- `npx tsc --noEmit` — PASS
- `node --experimental-strip-types --test src/tunnel-evenements.test.ts src/tunnel.test.ts` — PASS, 63/63
- `npm test` — PASS, 1 208/1 208
- `npm run build` — PASS (avertissement Vite préexistant sur la taille du chunk principal)

## Auto-revue / préoccupations

- Revue du diff et `git diff --check` effectuées : aucun défaut de whitespace.
- Aucun transport analytique n’a été introduit : seul un `CustomEvent` local est envoyé.
- La compatibilité Node/SSR est conservée : l’émetteur ne fait rien sans `document`.

## Fix round 1 — Partage sans presse-papiers

- RED : les nouveaux tests échouaient car `navigator.clipboard?.writeText()` rendait `undefined` sans API Clipboard ; `await` suivait alors la branche de succès et annonçait à tort « Copié ».
- GREEN : `partagerBilan()` vérifie explicitement `clipboard.writeText`, ne confirme la copie qu’après sa résolution et ouvre sinon l’invite « Votre bilan, à copier : ». Le bouton devient alors « Copiez ce bilan ».
- Le partage natif est tenté en premier. Un refus ou une annulation Web Share reprend explicitement le fallback presse-papiers puis invite, sans second événement `partage`.
- Tests ajoutés : API Clipboard absente (invite exacte + événement unique), rejet Clipboard, succès Clipboard, succès Web Share, refus Web Share avec fallback.
- Vérifications : événements+tunnel PASS 69/69 ; `npx tsc --noEmit` PASS ; suite complète PASS 1 214/1 214 ; build PASS (avertissement Vite préexistant sur le chunk principal).
