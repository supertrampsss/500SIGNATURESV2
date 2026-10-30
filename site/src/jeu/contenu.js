/* Contenu de Mandats : villes, dossiers, grandes réformes, profils de départ.
   Comptes 2025 : chiffres publiés. Tous les effets, sièges, opinions et montants
   de réformes sont des hypothèses de jeu, sans prévision sur la France. */
/* Villes : positions sur la carte nocturne (en %) */
export const VILLES = {
  Paris: [50, 23], Lille: [53, 12], Strasbourg: [78, 25], Metz: [71, 20], Caen: [37, 18], Rennes: [26, 35], Nantes: [26, 48],
  Bordeaux: [28, 65], Toulouse: [41, 78], Montpellier: [56, 77], Marseille: [67, 78], Lyon: [62, 52], Nice: [78, 68], 'Clermont-Ferrand': [50, 55], Ajaccio: [91, 83], 'Le Havre': [39, 16], 'Nouméa': [6, 90]
};
export const DOMAINES = { sante: 'Santé', educ: 'Éducation', secu: 'Sécurité', loge: 'Logement', trans: 'Transports', ener: 'Énergie' };

/* ---------- Dossiers ----------
   e : effets immédiats ; ch : chantier (effets après n trimestres) ; f : marqueur posé ; h : titre de presse.
   Clés : def (Md€/an), op, maj (sièges), ten, taux, + domaines. Toutes : hypothèses de jeu. */
export const D = [
 { id: 'urgences', dom: 'Santé', ville: 'Lille', titre: 'Les urgences débordent', texte: 'Douze heures d’attente aux urgences de Lille. Les soignants menacent de démissionner en bloc.', options: [
   { t: 'Plan d’urgence pour l’hôpital', d: '2 Md€ débloqués tout de suite pour des renforts et des lits.', e: { def: 2, op: 3, sante: 6 }, ch: { n: 2, t: 'Renforts hospitaliers en poste', e: { sante: 5 } }, h: 'Hôpital : 2 milliards débloqués en urgence' },
   { t: 'Réorganiser avec la médecine de ville', d: 'Gardes obligatoires en ville, moins cher mais conflictuel.', e: { def: .4, maj: -6, ten: 3 }, ch: { n: 3, t: 'Gardes de ville organisées', e: { sante: 9 } }, h: 'Médecins libéraux : les gardes deviennent obligatoires' },
   { t: 'Laisser les agences régionales gérer', d: 'Aucun coût, aucun signal.', e: { op: -3, sante: -4 }, h: 'Urgences : l’État renvoie aux agences régionales' } ] },
 { id: 'retraites', dom: 'Budget', ville: 'Paris', titre: 'Le déficit des retraites se creuse', texte: 'Le Conseil d’orientation des retraites prévoit un déficit croissant. Les syndicats sont prêts à mobiliser.', options: [
   { t: 'Allonger la durée de cotisation', d: 'Économies rapides, mobilisation garantie.', e: { def: -4, op: -7, ten: 14, maj: -12 }, ch: { n: 4, t: 'Réforme des retraites en vigueur', e: { def: -5 } }, f: 'reformeRetraites', h: 'Retraites : la durée de cotisation allongée' },
   { t: 'Ouvrir une conférence sociale', d: 'Six mois de négociation, résultat incertain.', e: { op: 1, ten: -3 }, ch: { n: 2, t: 'Conférence sociale sur les retraites', e: { def: -2, ten: -4 } }, h: 'Retraites : syndicats et patronat autour de la table' },
   { t: 'Ne rien changer', d: 'Le déficit continue de grossir.', e: { def: 2.5 }, h: 'Retraites : statu quo à l’Élysée' } ] },
 { id: 'electricite', dom: 'Énergie', ville: 'Lyon', titre: 'La facture d’électricité flambe', texte: 'Les tarifs réglementés doivent augmenter de 15 %. Les ménages modestes sont les plus exposés.', options: [
   { t: 'Bouclier tarifaire pour tous', d: 'L’État absorbe la hausse.', e: { def: 5, op: 5, ten: -6 }, f: 'bouclier', h: 'Électricité : l’État gèle les tarifs' },
   { t: 'Chèque énergie ciblé', d: 'Aide réservée aux ménages modestes.', e: { def: 1.5, op: 1, ten: -2 }, h: 'Électricité : un chèque pour les ménages modestes' },
   { t: 'Laisser passer la hausse', d: 'Pas de dépense, colère assurée.', e: { op: -5, ten: 8 }, h: 'Électricité : la hausse de 15 % s’applique' } ] },
 { id: 'bouclierFin', suite: 1, quand: s => s.f.bouclier && s.tour - s.f.bouclier >= 4, dom: 'Énergie', ville: 'Paris', titre: 'Sortir du bouclier tarifaire ?', texte: 'Le gel des tarifs coûte cher chaque année. La Cour des comptes demande un calendrier de sortie.', options: [
   { t: 'Sortie progressive sur un an', d: 'La facture remonte par paliers.', e: { def: -3, op: -3, ten: 4 }, h: 'Bouclier tarifaire : la sortie est programmée' },
   { t: 'Maintenir le bouclier', d: 'Le coût se prolonge.', e: { def: 1, op: 2 }, h: 'Le bouclier tarifaire prolongé' } ] },
 { id: 'epr', dom: 'Énergie', ville: 'Caen', titre: 'Le programme nucléaire', texte: 'EDF demande un feu vert pour de nouveaux réacteurs. Dix ans de chantier au minimum.', options: [
   { t: 'Lancer de nouveaux réacteurs', d: 'Investissement massif, effet très tardif.', e: { def: 2, maj: 5 }, ch: { n: 8, t: 'Premiers chantiers de réacteurs', e: { ener: 14 } }, f: 'epr', h: 'Nucléaire : feu vert à de nouveaux réacteurs' },
   { t: 'Prolonger le parc existant', d: 'Moins cher, gain limité.', e: { def: .8, ener: 5 }, h: 'Nucléaire : les centrales prolongées' },
   { t: 'Accélérer le renouvelable', d: 'Effet plus rapide, oppositions locales.', e: { def: 1.5, op: 2, maj: -4 }, ch: { n: 4, t: 'Parcs solaires et éoliens', e: { ener: 8 } }, h: 'Énergie : coup d’accélérateur sur le renouvelable' } ] },
 { id: 'eprSurcout', suite: 1, quand: s => s.f.epr && s.tour - s.f.epr >= 5, dom: 'Énergie', ville: 'Caen', titre: 'Surcoût sur le chantier nucléaire', texte: 'Le chantier annonce trois ans de retard et 4 Md€ de surcoût.', options: [
   { t: 'Recapitaliser EDF', d: 'Le chantier continue au même rythme.', e: { def: 2, op: -2 }, h: 'Nucléaire : l’État remet 4 milliards' },
   { t: 'Revoir le calendrier', d: 'Moins de dépenses, livraison repoussée.', e: { def: .5, ener: -3, maj: -3 }, h: 'Nucléaire : le calendrier glisse' } ] },
 { id: 'etudiants', dom: 'Logement', ville: 'Rennes', titre: 'Pas de logement pour les étudiants', texte: 'À la rentrée, des étudiants dorment dans leur voiture. Les loyers ont bondi de 9 %.', options: [
   { t: 'Construire des résidences', d: 'Effet dans 18 mois.', e: { def: 1.2 }, ch: { n: 6, t: 'Résidences étudiantes livrées', e: { loge: 10, op: 2 } }, h: 'Logement étudiant : un plan de construction lancé' },
   { t: 'Encadrer les loyers', d: 'Immédiat, contesté par les propriétaires.', e: { op: 3, maj: -6, loge: 3 }, h: 'Loyers : l’encadrement étendu' },
   { t: 'Augmenter les aides au logement', d: 'Soulage les étudiants, pas l’offre.', e: { def: 1.5, op: 2, loge: 2 }, h: 'Aides au logement : hausse pour les étudiants' } ] },
 { id: 'profs', dom: 'Éducation', ville: 'Bordeaux', titre: 'Personne ne veut plus enseigner', texte: 'Quatre mille postes non pourvus aux concours. Des classes sans professeur depuis la rentrée.', options: [
   { t: 'Revaloriser les salaires de 10 %', d: 'Cher, mais durable.', e: { def: 3, op: 3, educ: 4 }, ch: { n: 4, t: 'Concours de nouveau attractifs', e: { educ: 7 } }, h: 'Enseignants : 10 % d’augmentation' },
   { t: 'Recruter des contractuels', d: 'Rapide, qualité discutée.', e: { def: .6, educ: 2, ten: 2 }, h: 'Écoles : recours massif aux contractuels' },
   { t: 'Regrouper les petites classes', d: 'Économise des postes, fâche les maires.', e: { def: -.5, educ: -3, op: -2, maj: -3 }, h: 'Écoles rurales : les classes regroupées' } ] },
 { id: 'sncf', dom: 'Transports', ville: 'Marseille', titre: 'Grève dans les trains', texte: 'Les cheminots bloquent le trafic depuis cinq jours. Les vacances approchent.', options: [
   { t: 'Négocier tout de suite', d: 'Coût salarial, trafic rétabli.', e: { def: .8, ten: -8, op: -1 }, h: 'Trains : accord trouvé avec les cheminots' },
   { t: 'Imposer un service minimum par la loi', d: 'Populaire chez les usagers, conflit durable.', e: { maj: -5, ten: 8, op: 2 }, h: 'Service minimum : le gouvernement passe en force' },
   { t: 'Attendre que le mouvement s’essouffle', d: 'Aucun coût direct.', e: { trans: -6, op: -4, ten: 4 }, h: 'Grève : le gouvernement joue la montre' } ] },
 { id: 'fraude', dom: 'Recettes', ville: 'Paris', titre: 'La fraude fiscale', texte: 'Un rapport évalue la fraude à plusieurs dizaines de milliards par an. Les contrôleurs manquent.', options: [
   { t: 'Recruter des contrôleurs', d: 'Coût faible, rendement après un an.', e: { def: .3, op: 3 }, ch: { n: 4, t: 'Contrôles fiscaux renforcés', e: { def: -4 } }, h: 'Fraude fiscale : mille contrôleurs de plus' },
   { t: 'Amnistie pour les avoirs rapatriés', d: 'Recettes immédiates, image dégradée.', e: { def: -3, op: -4 }, h: 'Fraude : une amnistie qui fait débat' },
   { t: 'Ne rien changer', d: '', e: {}, h: 'Fraude fiscale : pas de nouvelles mesures' } ] },
 { id: 'agri', dom: 'Agriculture', ville: 'Toulouse', titre: 'Les agriculteurs bloquent les autoroutes', texte: 'Tracteurs sur l’A61. Ils dénoncent les normes et les prix trop bas.', options: [
   { t: 'Aides d’urgence', d: 'Les barrages se lèvent.', e: { def: 1.5, ten: -8 }, h: 'Agriculteurs : une aide d’urgence débloquée' },
   { t: 'Simplifier les normes', d: 'Gratuit, critiqué par les écologistes.', e: { ten: -5, maj: 3, op: 1 }, h: 'Agriculture : les normes allégées' },
   { t: 'Faire lever les barrages', d: 'Fermeté.', e: { ten: 6, op: -2 }, h: 'Barrages agricoles levés par les forces de l’ordre' } ] },
 { id: 'police', dom: 'Sécurité', ville: 'Marseille', titre: 'Commissariats à bout de souffle', texte: 'Effectifs en baisse, heures supplémentaires impayées. Les élus locaux alertent.', options: [
   { t: 'Recruter 5 000 policiers', d: 'Effet après la formation.', e: { def: 1.2 }, ch: { n: 4, t: 'Nouveaux policiers sur le terrain', e: { secu: 8, op: 2 } }, h: 'Sécurité : 5 000 policiers supplémentaires' },
   { t: 'S’appuyer sur les polices municipales', d: 'Rapide, inégal selon les villes.', e: { def: .3, secu: 3, maj: -3 }, h: 'Sécurité : plus de pouvoirs aux polices municipales' },
   { t: 'Redéployer les agents administratifs', d: 'Sans coût, syndicats mécontents.', e: { secu: 2, ten: 2 }, h: 'Police : les agents de bureau sur le terrain' } ] },
 { id: 'collectivites', dom: 'Territoires', ville: 'Strasbourg', titre: 'Les collectivités réclament leur dû', texte: 'Les maires dénoncent des charges transférées sans compensation.', options: [
   { t: 'Compenser intégralement', d: 'Le Sénat applaudit.', e: { def: 2, maj: 8 }, h: 'Collectivités : l’État compense' },
   { t: 'Geler les dotations', d: 'Économie, services locaux tendus.', e: { def: -2, maj: -8, loge: -2, trans: -2 }, h: 'Dotations gelées : colère des maires' },
   { t: 'Contrats pluriannuels', d: 'Compromis.', e: { def: -.5, maj: 2 }, h: 'Collectivités : des contrats sur trois ans' } ] },
 { id: 'chomage', dom: 'Emploi', ville: 'Nantes', titre: 'Assurance chômage : nouvelles règles ?', texte: 'Le régime est déficitaire. Les entreprises peinent pourtant à recruter.', options: [
   { t: 'Durcir les conditions', d: 'Économies, tension sociale.', e: { def: -3, op: -4, ten: 6 }, h: 'Chômage : les règles d’indemnisation durcies' },
   { t: 'Plan massif de formation', d: 'Coûteux, rentable à terme.', e: { def: 1 }, ch: { n: 4, t: 'Formations aux métiers en tension', e: { def: -2, op: 2 } }, h: 'Emploi : un grand plan de formation' },
   { t: 'Statu quo', d: '', e: {}, h: 'Assurance chômage : pas de changement' } ] },
 { id: 'ia', dom: 'État', ville: 'Rennes', titre: 'L’IA dans les administrations', texte: 'Les démarches en ligne accumulent les retards. Un plan numérique est sur la table.', options: [
   { t: 'Grand plan de modernisation', d: 'Investir maintenant, économiser plus tard.', e: { def: 1 }, ch: { n: 6, t: 'Services publics numériques', e: { def: -3, op: 2 } }, h: 'Administration : l’IA déployée dans les services' },
   { t: 'Expérimenter dans trois régions', d: 'Prudent.', e: { def: .2 }, ch: { n: 3, t: 'Expérimentation numérique', e: { def: -.5 } }, h: 'IA : une expérimentation dans trois régions' } ] },
 { id: 'canicule', saison: 2, dom: 'Climat', ville: 'Montpellier', titre: 'Canicule sur le Sud', texte: '43 °C à Montpellier. Hôpitaux et réseaux électriques sous tension.', options: [
   { t: 'Déclencher le plan canicule', d: 'Moyens d’urgence.', e: { def: .5, sante: 2, op: 2 }, h: 'Canicule : le plan d’urgence déclenché' },
   { t: 'Laisser faire les préfets', d: '', e: { sante: -5, op: -5, ten: 4 }, h: 'Canicule : polémique sur l’inaction' } ] },
 { id: 'deserts', dom: 'Santé', ville: 'Clermont-Ferrand', titre: 'Déserts médicaux', texte: 'Six millions de Français n’ont pas de médecin traitant.', options: [
   { t: 'Obliger l’installation des jeunes médecins', d: 'Efficace, conflit avec la profession.', e: { maj: -6, op: 2 }, ch: { n: 4, t: 'Jeunes médecins dans les zones sous-dotées', e: { sante: 7 } }, h: 'Médecins : installation régulée' },
   { t: 'Primes à l’installation', d: 'Coûteux, effet modeste.', e: { def: .8, sante: 3 }, h: 'Déserts médicaux : des primes pour s’installer' },
   { t: 'Généraliser la téléconsultation', d: 'Rapide, limité.', e: { def: .2, sante: 1 }, h: 'Téléconsultation généralisée' } ] },
 { id: 'lgv', dom: 'Transports', ville: 'Bordeaux', titre: 'La ligne à grande vitesse vers Toulouse', texte: 'Les régions demandent la part de l’État pour lancer les travaux.', options: [
   { t: 'Financer la part de l’État', d: 'Livraison dans plusieurs années.', e: { def: 1.5, maj: 4 }, ch: { n: 8, t: 'Ligne à grande vitesse en travaux', e: { trans: 10 } }, h: 'Grande vitesse : l’État paie sa part' },
   { t: 'Moderniser les lignes existantes', d: 'Moins cher, plus rapide.', e: { def: .6 }, ch: { n: 3, t: 'Lignes du quotidien modernisées', e: { trans: 5 } }, h: 'Rail : priorité aux trains du quotidien' },
   { t: 'Reporter', d: '', e: { trans: -2, maj: -4 }, h: 'Grande vitesse : le projet reporté' } ] },
 { id: 'patrimoine', dom: 'Recettes', ville: 'Paris', titre: 'Taxer les très hauts patrimoines ?', texte: 'Une proposition de taxe minimale sur les plus grandes fortunes gagne l’opinion.', options: [
   { t: 'Instaurer la taxe', d: 'Recettes et soutien populaire, majorité divisée.', e: { def: -3, op: 4, maj: -10 }, h: 'Une taxe sur les très hauts patrimoines adoptée' },
   { t: 'Taxer les rachats d’actions', d: 'Compromis.', e: { def: -1.5, op: 2, maj: -3 }, h: 'Rachats d’actions : une nouvelle taxe' },
   { t: 'Refuser', d: '', e: { op: -3, maj: 4 }, h: 'Hauts patrimoines : pas de nouvelle taxe' } ] },
 { id: 'tva', dom: 'Recettes', ville: 'Paris', titre: 'Basculer des cotisations vers la TVA', texte: 'Le patronat propose de baisser les cotisations et d’augmenter la TVA d’un point.', options: [
   { t: 'Basculer un point de TVA', d: 'Compétitivité, pouvoir d’achat en baisse.', e: { def: -4, op: -6, ten: 6, maj: 3 }, h: 'TVA : un point de plus pour baisser les cotisations' },
   { t: 'Refuser', d: '', e: { maj: -2 }, h: 'TVA sociale : le gouvernement dit non' } ] },
 { id: 'prisons', dom: 'Sécurité', ville: 'Lyon', titre: 'Prisons surpeuplées', texte: 'Taux d’occupation record. Le Conseil de l’Europe rappelle la France à l’ordre.', options: [
   { t: 'Construire de nouvelles places', d: 'Long et coûteux.', e: { def: 1 }, ch: { n: 6, t: 'Nouvelles places de prison', e: { secu: 5 } }, h: 'Prisons : un programme de construction' },
   { t: 'Développer les peines alternatives', d: 'Rapide, débat politique.', e: { secu: 2, op: -2, maj: -3 }, h: 'Justice : priorité aux peines alternatives' },
   { t: 'Ne rien changer', d: '', e: { secu: -3, ten: 2 }, h: 'Prisons : le statu quo dénoncé' } ] },
 { id: 'inondations', dom: 'Climat', ville: 'Nantes', titre: 'Inondations dans l’Ouest', texte: 'Des milliers de foyers sinistrés. Les assureurs tardent.', options: [
   { t: 'Fonds d’urgence de l’État', d: '', e: { def: 1, op: 3 }, h: 'Inondations : un fonds d’urgence pour les sinistrés' },
   { t: 'Presser les assureurs', d: 'Sans coût public.', e: { op: -2 }, h: 'Inondations : les assureurs sommés d’accélérer' } ] },
 { id: 'europe', dom: 'Europe', ville: 'Strasbourg', titre: 'Règles budgétaires européennes', texte: 'Bruxelles attend une trajectoire de réduction du déficit.', options: [
   { t: 'S’engager sur une trajectoire stricte', d: 'Les marchés apprécient.', e: { taux: -.3, maj: -4 }, f: 'trajectoire', h: 'Budget : la France s’engage auprès de Bruxelles' },
   { t: 'Demander un délai', d: 'Les taux montent légèrement.', e: { taux: .2, op: 1 }, h: 'Déficit : la France demande du temps' } ] },
 { id: 'usine', dom: 'Industrie', ville: 'Metz', titre: 'Une usine ferme en Lorraine', texte: 'Huit cents emplois menacés. Le repreneur exige des garanties.', options: [
   { t: 'Entrée temporaire de l’État au capital', d: 'Emplois sauvés, coût public.', e: { def: 1.5, op: 3, ten: -3 }, h: 'Lorraine : l’État entre au capital de l’usine' },
   { t: 'Aider le repreneur', d: 'Solution partielle.', e: { def: .5, ten: -1 }, h: 'Lorraine : un repreneur aidé par l’État' },
   { t: 'Laisser fermer', d: '', e: { op: -4, ten: 5 }, h: 'Lorraine : l’usine ferme ses portes' } ] },
 { id: 'scandale', dom: 'Gouvernement', ville: 'Paris', titre: 'Un ministre mis en cause', texte: 'Une enquête vise un ministre pour des frais de campagne.', options: [
   { t: 'Exiger sa démission', d: '', e: { op: 2, maj: -2 }, h: 'Le ministre démissionne' },
   { t: 'Le maintenir', d: '', e: { op: -5 }, h: 'L’Élysée maintient sa confiance au ministre' } ] },
 { id: 'mobilisation', suite: 1, quand: s => s.f.reformeRetraites && s.tour - s.f.reformeRetraites >= 1 && s.tour - s.f.reformeRetraites <= 3, dom: 'Social', ville: 'Paris', titre: 'La rue contre la réforme des retraites', texte: 'Un million de manifestants selon les syndicats. Les raffineries sont bloquées.', options: [
   { t: 'Maintenir la réforme', d: 'La mobilisation peut durer.', e: { ten: 8, op: -3 }, h: 'Retraites : l’exécutif ne cède pas' },
   { t: 'Amender la réforme', d: 'Moins d’économies.', e: { def: 2, ten: -10, op: 2 }, h: 'Retraites : des concessions sur les carrières longues' } ] },
 { id: 'marches', crise: 1, quand: s => s.def >= 175 || s.taux >= 4.2, dom: 'Crise', ville: 'Paris', titre: 'Les marchés s’inquiètent', texte: 'Le taux d’emprunt de la France décroche de celui de l’Allemagne. Une agence menace de dégrader la note.', options: [
   { t: 'Plan d’économies immédiat de 10 Md€', d: 'Rassure les marchés, coupe dans les services.', e: { def: -10, op: -8, ten: 10, taux: -.4, sante: -3, educ: -3, trans: -3 }, h: 'Plan de rigueur : 10 milliards d’économies' },
   { t: 'Hausse ciblée d’impôts', d: 'Recettes rapides.', e: { def: -6, op: -5, maj: -6, taux: -.2 }, h: 'Budget rectificatif : des impôts en hausse' },
   { t: 'Rassurer sans mesures', d: 'Pari risqué.', e: { taux: .5, op: 1 }, h: 'Dette : les taux continuent de grimper' } ] },
 { id: 'hopitaux', crise: 1, quand: s => s.sante <= 28, dom: 'Crise', ville: 'Lyon', titre: 'Les hôpitaux en rupture', texte: 'Des services ferment la nuit dans plusieurs départements.', options: [
   { t: 'Réquisitionner et financer', d: '', e: { def: 3, sante: 10, op: 2 }, h: 'Santé : réquisitions et crédits d’urgence' },
   { t: 'Transférer les patients', d: '', e: { sante: 3, op: -5, ten: 4 }, h: 'Santé : des patients transférés à 200 km' } ] },
 /* ---------- La rue : escalade en cinq niveaux ---------- */
 { id: 'rue1', crise: 1, niv: 1, recur: 2, quand: s => s.rue === 1, dom: 'La rue', ville: 'Paris', titre: 'Manifestations dans toutes les grandes villes', texte: 'Des centaines de milliers de personnes défilent contre la vie chère et vos réformes. Les syndicats appellent à durcir le mouvement.', options: [
   { t: 'Recevoir les syndicats à l’Élysée', d: 'Un geste qui peut apaiser, ou être lu comme une faiblesse.', e: { ten: -7, op: 1, maj: -2 }, h: 'L’Élysée ouvre ses portes aux syndicats' },
   { t: 'Faire interdire les rassemblements par les préfets', d: 'Calme apparent, colère rentrée.', e: { ten: 4, op: -3, secu: 2 }, h: 'Manifestations : les préfets interdisent les rassemblements' },
   { t: 'Ne pas réagir', d: 'Parier sur l’essoufflement.', e: { ten: 3, op: -2 }, h: 'Le gouvernement mise sur l’essoufflement' } ] },
 { id: 'rue2', crise: 1, niv: 2, recur: 2, quand: s => s.rue === 2, dom: 'La rue', ville: 'Le Havre', titre: 'Le pays bloqué', texte: 'Raffineries, ports et ronds-points bloqués. Un tiers des stations-service sont à sec.', options: [
   { t: 'Réquisitionner les grévistes des raffineries', d: 'L’essence revient, la colère monte d’un cran.', e: { ten: 5, ener: 4, trans: 3, op: -2, maj: -3 }, h: 'Raffineries : le gouvernement réquisitionne' },
   { t: 'Céder sur une mesure phare', d: 'Les blocages se lèvent. Votre crédibilité en prend un coup.', e: { ten: -14, def: 3, op: 1, maj: -6 }, h: 'Le gouvernement recule sous la pression des blocages' },
   { t: 'Faire lever les barrages par les forces de l’ordre', d: 'Rapide, mais des images violentes peuvent tout faire basculer.', e: { ten: -6, trans: 4, op: -2 }, risque: { p: .3, e: { ten: 14, op: -8 }, titre: 'Un manifestant grièvement blessé', texte: 'L’évacuation d’un dépôt pétrolier tourne mal. La vidéo fait le tour des réseaux en une heure.', h: 'Évacuation d’un blocage : un manifestant grièvement blessé' }, h: 'Barrages levés par les forces de l’ordre' } ] },
 { id: 'rue3', crise: 1, niv: 3, recur: 2, quand: s => s.rue === 3, dom: 'La rue', ville: 'Marseille', titre: 'Nuits d’émeutes', texte: 'Troisième nuit de violences. Mairies et commissariats incendiés dans plusieurs villes. Les maires réclament l’état d’urgence.', options: [
   { t: 'Couvre-feu et état d’urgence', d: 'Pouvoirs de police étendus pour douze jours.', e: { ten: -10, secu: 4, op: -3, maj: -3 }, h: 'État d’urgence décrété, couvre-feu dans 40 villes' },
   { t: 'Déployer l’armée en soutien de la police', d: 'Une première depuis des décennies. Peut ramener l’ordre, ou tourner au drame.', e: { ten: -16, secu: 6, op: -4, maj: 2 }, risque: { p: .35, e: { ten: 22, op: -14, maj: -15 }, titre: 'Un soldat ouvre le feu', texte: 'Un jeune homme est tué lors d’un contrôle par une patrouille militaire. Le pays s’embrase.', h: 'Drame : un jeune tué par une patrouille militaire' }, h: 'L’armée déployée dans les rues' },
   { t: 'Plan d’urgence pour les quartiers et appel au calme', d: 'Argent public, effet lent, risque de paraître céder.', e: { def: 3, ten: -6, op: 1 }, ch: { n: 2, t: 'Plan d’urgence pour les quartiers', e: { ten: -10, loge: 3 } }, h: 'Émeutes : un plan d’urgence pour les quartiers' } ] },
 { id: 'rue4', crise: 1, niv: 4, recur: 1, quand: s => s.rue === 4, dom: 'Insurrection', ville: 'Paris', titre: 'L’Élysée encerclé', texte: 'Des dizaines de milliers de personnes marchent sur l’Élysée. Des ministres démissionnent. Si rien ne change ce trimestre, votre mandat est perdu.', options: [
   { t: 'Envoyer l’armée et recourir à l’article 16', d: 'Les pleins pouvoirs. Tout se joue sur un coup de dés.', e: { ten: -30, op: -10, maj: -25 }, risque: { p: .45, e: { ten: 30, op: -25 }, titre: 'Des morts devant l’Élysée', texte: 'La troupe tire. Le bilan est lourd. Les chefs d’état-major refusent de poursuivre.', h: 'Article 16 : des morts devant l’Élysée' }, h: 'Article 16 : l’armée rétablit l’ordre à Paris' },
   { t: 'Dissoudre l’Assemblée et rendre la parole au peuple', d: 'Les élections redistribuent tous les sièges selon votre popularité.', e: { ten: -18 }, special: 'dissolution', h: 'Dissolution : les Français retournent aux urnes' },
   { t: 'Retirer toutes les réformes contestées', d: 'Le calme revient, le budget et votre autorité s’effondrent.', e: { ten: -32, def: 8, op: 4, maj: -18 }, h: 'Le Président retire toutes ses réformes' },
   { t: 'Démissionner', d: 'Partir avant d’être chassé.', e: {}, special: 'demission', h: 'Le Président de la République démissionne' } ] },
 /* ---------- Actualité nationale et internationale ---------- */
 { id: 'narco', dom: 'Sécurité', ville: 'Marseille', titre: 'Les cartels prennent un port', texte: 'Règlements de comptes chaque semaine. Les douaniers sont menacés jusqu’à leur domicile.', options: [
   { t: 'Armée et marine pour verrouiller les ports', d: 'Démonstration de force, coûteuse.', e: { def: 1.5, secu: 7, op: 3, maj: 3 }, h: 'Narcotrafic : l’armée verrouille les ports' },
   { t: 'Légaliser le cannabis sous contrôle de l’État', d: 'Assécher le marché. La moitié du pays s’y oppose.', e: { def: -1.5, secu: 4, op: -3, maj: -10, ten: 2 }, h: 'Cannabis : la France légalise' },
   { t: 'Police judiciaire et juges spécialisés', d: 'Lent mais durable.', e: { def: .8 }, ch: { n: 4, t: 'Parquet national antidrogue', e: { secu: 7 } }, h: 'Narcotrafic : un parquet national créé' } ] },
 { id: 'finvie', dom: 'Société', ville: 'Paris', titre: 'Fin de vie : légaliser l’aide à mourir ?', texte: 'Le texte divise jusque dans votre camp. Les soignants sont partagés.', options: [
   { t: 'Légaliser avec des conditions strictes', d: '', e: { op: 3, maj: -6, ten: 2 }, h: 'Aide à mourir : la loi adoptée' },
   { t: 'Renforcer seulement les soins palliatifs', d: '', e: { def: 1, sante: 3, op: -1 }, h: 'Fin de vie : priorité aux soins palliatifs' },
   { t: 'Soumettre la question à référendum', d: 'Le pays tranche, la campagne sera vive.', e: { op: 4, ten: 3, maj: -2 }, h: 'Fin de vie : un référendum annoncé' } ] },
 { id: 'regul', dom: 'Immigration', ville: 'Paris', titre: 'Travailleurs sans papiers dans les métiers en tension', texte: 'Restauration, bâtiment, aide à domicile : des employeurs demandent des régularisations. D’autres réclament des expulsions.', options: [
   { t: 'Régularisation ciblée par métier', d: '', e: { def: -.5, op: -3, maj: -8, ten: 4 }, h: 'Régularisation dans les métiers en tension' },
   { t: 'Fermeté et expulsions', d: '', e: { def: .6, op: 2, maj: 3, ten: 4 }, h: 'Immigration : le gouvernement durcit le ton' },
   { t: 'Quotas annuels votés par le Parlement', d: 'Compromis qui ne satisfait personne.', e: { maj: -3, op: 1 }, h: 'Immigration : des quotas votés chaque année' } ] },
 { id: 'ame', dom: 'Santé', ville: 'Paris', titre: 'Supprimer l’aide médicale d’État ?', texte: 'Une partie de la majorité veut la remplacer par une aide d’urgence. Les médecins alertent sur les risques sanitaires.', options: [
   { t: 'La remplacer par une aide d’urgence', d: '', e: { def: -.8, op: 1, maj: 3, sante: -2, ten: 3 }, h: 'L’aide médicale d’État remplacée' },
   { t: 'La maintenir', d: '', e: { op: -2, maj: -3 }, h: 'L’aide médicale d’État maintenue' } ] },
 { id: 'mercosur', dom: 'Europe', ville: 'Toulouse', titre: 'L’accord avec le Mercosur', texte: 'Bruxelles veut conclure. Les agriculteurs menacent de bloquer le pays, l’industrie y voit des débouchés.', options: [
   { t: 'Voter pour l’accord', d: '', e: { def: -.5, maj: 2, op: -4, ten: 7 }, h: 'Mercosur : la France dit oui' },
   { t: 'Bloquer l’accord au Conseil européen', d: '', e: { op: 4, maj: -2, taux: .1 }, h: 'Mercosur : la France met son veto' },
   { t: 'Exiger des clauses miroirs', d: 'Gagner du temps.', e: { op: 1, ten: -1 }, h: 'Mercosur : Paris exige des clauses miroirs' } ] },
 { id: 'caledonie', crise: 0, dom: 'Outre-mer', ville: 'Nouméa', titre: 'Nouméa s’embrase', texte: 'Barrages, pillages, couvre-feu. Indépendantistes et loyalistes s’affrontent.', options: [
   { t: 'Envoyer l’armée et décréter l’état d’urgence', d: '', e: { def: 1, secu: 3, ten: -2, op: 2 }, risque: { p: .3, e: { op: -8, ten: 6 }, titre: 'Des morts à Nouméa', texte: 'Les affrontements font plusieurs victimes. L’ONU appelle à la retenue.', h: 'Nouvelle-Calédonie : des morts lors des affrontements' }, h: 'Nouvelle-Calédonie : l’armée déployée' },
   { t: 'Rouvrir la négociation sur l’autonomie', d: '', e: { maj: -4, ten: -2, op: 1 }, h: 'Nouvelle-Calédonie : les négociations reprennent' },
   { t: 'Organiser un nouveau référendum', d: '', e: { op: 2, maj: -3 }, h: 'Nouvelle-Calédonie : nouveau référendum annoncé' } ] },
 { id: 'ormuz', dom: 'International', ville: 'Marseille', titre: 'Pétroliers attaqués dans le détroit d’Ormuz', texte: 'Le baril bondit de 30 %. Le gazole dépasse 2,40 € le litre.', options: [
   { t: 'Envoyer la marine escorter les navires', d: '', e: { def: 1, maj: 3, op: 2 }, risque: { p: .2, e: { op: -6, ten: 4 }, titre: 'Une frégate touchée', texte: 'Un missile frappe une frégate française. Des marins sont blessés.', h: 'Ormuz : une frégate française touchée' }, h: 'Ormuz : la marine française escorte les pétroliers' },
   { t: 'Baisser les taxes sur le carburant', d: '', e: { def: 3.5, op: 4, ten: -5 }, h: 'Carburant : les taxes baissent de 20 centimes' },
   { t: 'Laisser les prix monter', d: '', e: { def: -1, op: -5, ten: 7 }, h: 'Carburant : le gouvernement ne bouge pas' } ] },
 { id: 'ukraine', dom: 'International', ville: 'Paris', titre: 'Ukraine : nouvelle demande d’aide', texte: 'Kiev demande des munitions et de la défense aérienne avant l’hiver.', options: [
   { t: '3 Md€ d’aide militaire', d: '', e: { def: 3, maj: 2, op: -1 }, h: 'Ukraine : 3 milliards d’aide militaire' },
   { t: 'Aide humanitaire uniquement', d: '', e: { def: .5, maj: -3, op: 1 }, h: 'Ukraine : la France limite son aide à l’humanitaire' },
   { t: 'Proposer une conférence de paix à Paris', d: '', e: { op: 2, maj: -2 }, h: 'Ukraine : Paris propose une conférence de paix' } ] },
 { id: 'tarifs', dom: 'International', ville: 'Bordeaux', titre: 'Washington taxe les vins et spiritueux', texte: 'Droits de douane de 25 % sur les produits européens. Viticulteurs et distillateurs paniquent.', options: [
   { t: 'Riposte européenne coordonnée', d: '', e: { op: 3, def: -.5, ten: 1 }, h: 'Droits de douane : l’Europe riposte' },
   { t: 'Aider les filières touchées', d: '', e: { def: 1.5, ten: -3 }, h: 'Viticulture : un plan d’aide d’urgence' },
   { t: 'Négocier seul avec Washington', d: '', e: { op: -2, maj: -2 }, h: 'Paris négocie seul avec Washington' } ] },
 { id: 'reseaux', dom: 'Société', ville: 'Lyon', titre: 'Interdire les réseaux sociaux aux moins de 15 ans ?', texte: 'Santé mentale des adolescents en chute. Les plateformes menacent de quitter le marché français.', options: [
   { t: 'Interdire avec vérification d’âge', d: '', e: { op: 4, maj: 2, ten: 1 }, h: 'Réseaux sociaux interdits aux moins de 15 ans' },
   { t: 'Miser sur l’éducation et le contrôle parental', d: '', e: { def: .3, educ: 1 }, h: 'Réseaux sociaux : un plan d’éducation' },
   { t: 'Ne rien faire', d: '', e: { op: -2 }, h: 'Réseaux sociaux : pas d’interdiction' } ] },
 { id: 'service', dom: 'Défense', ville: 'Strasbourg', titre: 'Rétablir un service militaire ?', texte: 'L’état-major s’inquiète des effectifs. La jeunesse est partagée.', options: [
   { t: 'Service obligatoire de trois mois', d: '', e: { def: 2.5, op: 1, ten: 4, maj: 3 }, h: 'Le service militaire obligatoire rétabli' },
   { t: 'Service volontaire rémunéré', d: '', e: { def: 1, op: 2 }, h: 'Un service militaire volontaire créé' },
   { t: 'Refuser', d: '', e: { maj: -2 }, h: 'Pas de retour du service militaire' } ] },
 { id: 'zfe', dom: 'Environnement', ville: 'Lyon', titre: 'Zones à faibles émissions : les automobilistes en colère', texte: 'Des millions de voitures anciennes bientôt interdites en ville.', options: [
   { t: 'Suspendre les zones', d: '', e: { op: 3, ten: -3, maj: -2, sante: -1 }, h: 'Zones à faibles émissions suspendues' },
   { t: 'Maintenir avec une prime à la conversion', d: '', e: { def: 1, op: -1 }, h: 'ZFE maintenues, la prime à la conversion relevée' },
   { t: 'Durcir le calendrier', d: '', e: { op: -5, ten: 6, sante: 2 }, h: 'ZFE : le calendrier durci' } ] },
 { id: 'vacants', dom: 'Logement', ville: 'Paris', titre: 'Réquisitionner les logements vides ?', texte: 'Trois millions de logements vacants, des familles à la rue cet hiver.', options: [
   { t: 'Réquisitionner', d: '', e: { loge: 6, op: 2, maj: -8, ten: -1 }, h: 'Logements vides : la réquisition décidée' },
   { t: 'Tripler la taxe sur les logements vacants', d: '', e: { def: -1, loge: 3, maj: -3 }, h: 'La taxe sur les logements vacants triplée' },
   { t: 'Programme public de construction', d: '', e: { def: 2 }, ch: { n: 6, t: 'Logements sociaux livrés', e: { loge: 8 } }, h: 'Logement : un programme public de construction' } ] },
 { id: 'apl', dom: 'Budget', ville: 'Nantes', titre: 'Geler les aides au logement ?', texte: 'Bercy propose de geler les APL pour économiser. Les associations parlent d’un « budget anti-pauvres ».', options: [
   { t: 'Geler les aides', d: '', e: { def: -1.5, op: -4, ten: 5, loge: -3 }, h: 'APL : les aides gelées' },
   { t: 'Les maintenir', d: '', e: { op: 1 }, h: 'APL : pas de gel' },
   { t: 'Les recentrer sur les plus modestes', d: '', e: { def: -.8, op: -1, loge: -1 }, h: 'APL : les aides recentrées' } ] },
 { id: 'viechere', dom: 'Pouvoir d’achat', ville: 'Lille', titre: 'Les prix alimentaires flambent', texte: '+12 % en un an. Les banques alimentaires débordent.', options: [
   { t: 'Bloquer les prix de 100 produits', d: '', e: { op: 5, maj: -4, def: .5 }, h: 'Vie chère : 100 produits à prix bloqué' },
   { t: 'TVA à 0 % sur les produits de base', d: '', e: { def: 4, op: 6, ten: -5 }, h: 'TVA supprimée sur les produits de base' },
   { t: 'Chèque alimentaire ciblé', d: '', e: { def: 2, op: 2, ten: -2 }, h: 'Un chèque alimentaire pour les plus modestes' } ] },
 { id: 'dockers', dom: 'Social', ville: 'Le Havre', titre: 'Grève des dockers', texte: 'Vingt ports à l’arrêt. Les supermarchés craignent les ruptures.', options: [
   { t: 'Négocier', d: '', e: { def: .6, ten: -5 }, h: 'Dockers : accord trouvé' },
   { t: 'Réquisitionner', d: '', e: { ten: 7, maj: -2, op: -1, trans: 2 }, h: 'Ports : le gouvernement réquisitionne les dockers' },
   { t: 'Attendre', d: '', e: { trans: -5, op: -3 }, h: 'Ports bloqués : le gouvernement attend' } ] },
 { id: 'lyceens', dom: 'Éducation', ville: 'Rennes', titre: 'Les lycées bloqués', texte: 'Poubelles en feu devant 300 lycées. Les parents s’inquiètent.', options: [
   { t: 'Dialoguer avec les organisations lycéennes', d: '', e: { ten: -3, op: 1 }, h: 'Lycées : le ministre reçoit les lycéens' },
   { t: 'Faire évacuer les blocages', d: '', e: { ten: 3, op: -1 }, risque: { p: .2, e: { ten: 9, op: -6 }, titre: 'Un lycéen blessé', texte: 'Une vidéo montre un lycéen blessé par un tir de LBD.', h: 'Un lycéen blessé lors d’une évacuation' }, h: 'Lycées : les blocages évacués' },
   { t: 'Retirer la réforme contestée', d: '', e: { educ: -1, ten: -6, maj: -3 }, h: 'Éducation : la réforme retirée' } ] },
 { id: 'proportionnelle', dom: 'Institutions', ville: 'Paris', titre: 'La proportionnelle aux législatives ?', texte: 'Une promesse ancienne. Elle compliquerait toute majorité future.', options: [
   { t: 'L’instaurer', d: '', e: { op: 4, maj: -8 }, h: 'La proportionnelle adoptée' },
   { t: 'Refuser', d: '', e: { op: -2, maj: 2 }, h: 'Pas de proportionnelle' } ] },
 { id: 'ric', dom: 'Institutions', ville: 'Paris', titre: 'Un référendum d’initiative citoyenne ?', texte: 'Une pétition dépasse deux millions de signatures.', options: [
   { t: 'L’instaurer', d: '', e: { op: 6, maj: -10, ten: -5 }, h: 'Le référendum d’initiative citoyenne instauré' },
   { t: 'Refuser', d: '', e: { op: -3, ten: 3 }, h: 'Référendum d’initiative citoyenne : c’est non' } ] },
 { id: 'iaemploi', dom: 'Emploi', ville: 'Lyon', titre: 'L’IA menace 300 000 emplois de bureau', texte: 'Banques et assurances annoncent des plans de départ.', options: [
   { t: 'Taxer l’automatisation', d: '', e: { def: -1, op: 2, maj: -4 }, h: 'Une taxe sur l’automatisation' },
   { t: 'Plan national de reconversion', d: '', e: { def: 1.5 }, ch: { n: 4, t: 'Reconversions vers les métiers en tension', e: { op: 2, ten: -3 } }, h: 'IA : un plan de reconversion massif' },
   { t: 'Laisser faire le marché', d: '', e: { op: -3, ten: 3 }, h: 'IA : le gouvernement laisse faire' } ] },
 { id: 'fonctionnaires', dom: 'Budget', ville: 'Paris', titre: 'Supprimer 50 000 postes de fonctionnaires ?', texte: 'La Cour des comptes pointe la masse salariale.', options: [
   { t: 'Supprimer 50 000 postes', d: '', e: { def: -3, op: -3, ten: 6, educ: -2, sante: -2 }, ch: { n: 4, t: 'Suppressions de postes effectives', e: { def: -2 } }, h: '50 000 postes de fonctionnaires supprimés' },
   { t: 'Ne remplacer qu’un départ sur deux', d: '', e: { def: -1, educ: -1, ten: 2 }, h: 'Fonction publique : un départ sur deux remplacé' },
   { t: 'Refuser', d: '', e: { maj: -2 }, h: 'Pas de suppressions de postes' } ] },
 { id: 'secheresse', saison: 2, dom: 'Climat', ville: 'Toulouse', titre: 'La guerre de l’eau', texte: 'Rivières à sec. Agriculteurs et villes se disputent les réserves.', options: [
   { t: 'Autoriser de grandes réserves agricoles', d: '', e: { maj: 3, ten: 4, op: -2 }, risque: { p: .25, e: { ten: 8, op: -4 }, titre: 'Affrontements autour d’une réserve', texte: 'Des milliers de militants affrontent les gendarmes sur un chantier.', h: 'Bassines : violents affrontements' }, h: 'Eau : les grandes réserves autorisées' },
   { t: 'Restrictions pour tous', d: '', e: { op: -3, ten: 1 }, h: 'Sécheresse : restrictions d’eau généralisées' },
   { t: 'Priorité à l’eau potable, aides aux agriculteurs', d: '', e: { def: 1, ten: -1 }, h: 'Sécheresse : l’eau potable d’abord' } ] },
 { id: 'cyber', dom: 'Sécurité', ville: 'Lille', titre: 'Cyberattaque contre les hôpitaux', texte: 'Quinze hôpitaux paralysés. Les pirates réclament une rançon.', options: [
   { t: 'Refuser de payer, plan cyber national', d: '', e: { def: 1.5, sante: -2 }, ch: { n: 3, t: 'Bouclier cyber des hôpitaux', e: { sante: 3, secu: 2 } }, h: 'Cyberattaque : la France refuse de payer' },
   { t: 'Laisser les hôpitaux négocier', d: '', e: { op: -5, sante: 1 }, h: 'Cyberattaque : polémique sur une rançon payée' } ] },
 { id: 'manche', dom: 'Immigration', ville: 'Lille', titre: 'Naufrage dans la Manche', texte: 'Vingt-sept morts au large de Calais. Londres accuse Paris.', options: [
   { t: 'Accord de réadmission avec Londres', d: '', e: { def: .5, op: 1, maj: -1 }, h: 'Manche : accord avec Londres' },
   { t: 'Renforcer la surveillance des côtes', d: '', e: { def: .8, op: 1, maj: 2 }, h: 'Manche : la surveillance des côtes renforcée' },
   { t: 'Ouvrir des voies d’accès légales', d: '', e: { op: -2, maj: -5 }, h: 'Manche : des voies légales vers le Royaume-Uni' } ] },
 { id: 'corse', dom: 'Territoires', ville: 'Ajaccio', titre: 'L’autonomie de la Corse', texte: 'L’Assemblée de Corse réclame un pouvoir législatif.', options: [
   { t: 'Accorder l’autonomie', d: '', e: { maj: -5, op: 1, ten: -2 }, h: 'Corse : l’autonomie accordée' },
   { t: 'Refuser', d: '', e: { ten: 3, maj: 2 }, h: 'Corse : Paris dit non à l’autonomie' } ] },
 { id: 'smic', dom: 'Pouvoir d’achat', ville: 'Lille', titre: 'Augmenter le SMIC de 10 % ?', texte: 'Les syndicats en font une condition du dialogue. Le patronat prédit des faillites.', options: [
   { t: 'Oui, 10 %', d: '', e: { op: 6, def: 2, ten: -6, maj: -4 }, h: 'SMIC : +10 %' },
   { t: 'Un coup de pouce de 2 %', d: '', e: { op: 1, ten: -1 }, h: 'SMIC : un coup de pouce de 2 %' },
   { t: 'Non', d: '', e: { op: -3, ten: 3, maj: 2 }, h: 'Pas de coup de pouce au SMIC' } ] },
 { id: 'successions', dom: 'Recettes', ville: 'Paris', titre: 'Taxer davantage les grosses successions ?', texte: 'Les héritages représentent une part croissante des patrimoines.', options: [
   { t: 'Alourdir les grosses successions', d: '', e: { def: -2, op: 1, maj: -6 }, h: 'Successions : les gros héritages taxés davantage' },
   { t: 'Baisser les droits de succession', d: '', e: { def: 1.5, op: -2, maj: 4 }, h: 'Successions : les droits baissent' } ] },
 { id: 'rail', dom: 'Transports', ville: 'Lyon', titre: 'Ouvrir le rail à la concurrence', texte: 'Bruxelles presse. Les cheminots promettent la grève.', options: [
   { t: 'Ouvrir toutes les lignes', d: '', e: { def: -1, ten: 6 }, ch: { n: 4, t: 'Nouveaux opérateurs ferroviaires', e: { trans: 4 } }, h: 'Rail : la concurrence généralisée' },
   { t: 'Ouvrir seulement les lignes régionales', d: '', e: { ten: 2 }, h: 'Rail : ouverture limitée aux régions' },
   { t: 'Refuser', d: '', e: { maj: -2, taux: .05 }, h: 'Rail : la France refuse l’ouverture' } ] }
];

export const RUE = [['Calme', ''], ['Manifestations', 'Des centaines de milliers de manifestants'], ['Blocages', 'Le pays se bloque'], ['Émeutes', 'Les villes s’embrasent'], ['Insurrection', 'Insurrection : le pouvoir vacille']];
/* ---------- Grandes réformes : économies structurelles. Montants : hypothèses de jeu, ordres de grandeur. ---------- */
export const REFORMES = [
  { id: 'age', t: 'Retraites : âge légal à 66 ans', d: 'Recul progressif de l’âge de départ.', eco: 14, vote: -25, e: { op: -8, ten: 18 }, ch: { n: 6, t: 'Recul de l’âge de départ', e: { def: -14 } } },
  { id: 'desindex', t: 'Geler pensions et prestations un an', d: 'Pas de revalorisation sur l’inflation pendant un an.', eco: 10, vote: -30, e: { def: -10, op: -7, ten: 12 } },
  { id: 'niches', t: 'Supprimer la moitié des niches fiscales', d: 'Crédits d’impôt, taux réduits, exonérations.', eco: 15, vote: -20, e: { op: 1, ten: 4, maj: -6 }, ch: { n: 2, t: 'Niches fiscales supprimées', e: { def: -15 } } },
  { id: 'aides', t: 'Réduire de 20 % les aides aux entreprises', d: 'Exonérations de cotisations et subventions recentrées.', eco: 18, vote: -18, e: { op: 3, ten: 2, maj: -8 }, ch: { n: 2, t: 'Aides aux entreprises recentrées', e: { def: -18, op: -2 } } },
  { id: 'csg', t: 'Hausse de 2 points de CSG', d: 'Sur tous les revenus, y compris les pensions.', eco: 25, vote: -35, e: { def: -25, op: -10, ten: 10 } },
  { id: 'tva', t: 'TVA à 22 %', d: 'Deux points de plus sur le taux normal.', eco: 20, vote: -30, e: { def: -20, op: -9, ten: 12 } },
  { id: 'patrimoine', t: 'Impôt plancher sur les très grandes fortunes', d: '2 % par an sur les patrimoines de plus de 100 M€.', eco: 15, vote: -22, e: { op: 5, maj: -6 }, ch: { n: 4, t: 'Impôt plancher sur les grandes fortunes', e: { def: -15 } }, risque: { p: .4, e: { def: 8 }, titre: 'Exil de grandes fortunes', texte: 'Plusieurs grands patrimoines quittent le pays. Le rendement attendu est divisé par deux.', h: 'Impôt plancher : des départs à l’étranger' } },
  { id: 'fonction', t: 'Aucun remplacement de fonctionnaire pendant trois ans', d: 'Tous les départs en retraite non remplacés.', eco: 12, vote: -15, e: { ten: 10, op: -3 }, ch: { n: 4, t: 'Gel des recrutements publics', e: { def: -12, educ: -6, sante: -6, secu: -4 } } },
  { id: 'departements', t: 'Supprimer les départements', d: 'Compétences transférées aux régions et intercommunalités.', eco: 8, vote: -40, e: { maj: -8, op: 2 }, ch: { n: 8, t: 'Fusion des collectivités', e: { def: -8 } } },
  { id: 'franchises', t: 'Doubler les franchises médicales', d: 'Reste à charge plus élevé sur les médicaments et consultations.', eco: 6, vote: -15, e: { def: -6, op: -5, sante: -2, ten: 5 } },
  { id: 'chomage', t: 'Durée d’indemnisation chômage réduite de 25 %', d: '', eco: 4, vote: -10, e: { def: -4, op: -3, ten: 8 } },
  { id: 'temps', t: 'Fin des 35 heures dans la fonction publique', d: 'Temps de travail porté à 37 heures sans hausse de salaire.', eco: 5, vote: -12, e: { def: -5, ten: 9, op: -2 } },
  { id: 'alloc', t: 'Allocations familiales sous conditions de ressources', d: '', eco: 3, vote: -10, e: { def: -3, op: -2, maj: -3 } },
  { id: 'ameR', t: 'Remplacer l’aide médicale d’État par une aide d’urgence', d: 'Une mesure symbolique, à l’impact budgétaire limité.', eco: 1.2, vote: -5, e: { def: -1.2, op: 1, ten: 4, sante: -2 } }
];
/* ---------- État ---------- */
export const PROFILS = [
  { id: 'relative', t: 'Majorité relative', d: 'Il faudra négocier chaque texte.', maj: 245, op: 41, ten: 38 },
  { id: 'absolue', t: 'Majorité absolue', d: 'Les mains libres, une opinion méfiante.', maj: 305, op: 35, ten: 45 },
  { id: 'cohabitation', t: 'Assemblée hostile', d: 'Populaire, mais minoritaire au Parlement.', maj: 205, op: 47, ten: 32 }
];
