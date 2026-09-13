# Documentation fonctionnelle — Backoffice Konodal

*Dernière mise à jour : 2026-08-05*

## 1. Présentation générale

Le backoffice Konodal est l'outil de pilotage utilisé par les équipes Konodal et les gérances/syndics partenaires pour administrer les résidences suivies via l'application mobile résident **Konodal**. Les deux applications partagent la même base de données : toute action réalisée dans le backoffice (validation d'un compte, création d'une intervention, publication d'une communication...) est immédiatement visible côté résident, et inversement.

### 1.1 Profils utilisateurs

Le backoffice distingue quatre profils, avec des périmètres d'accès différents :

| Profil | Description | Accès |
|---|---|---|
| **Super Admin** | Équipe Konodal | Accès complet à toutes les résidences et à toutes les fonctionnalités, y compris les plus sensibles (validation d'identité, suppression de compte, publicités, facturation des gérances) |
| **Agence** | Société de syndic ou de gérance locative partenaire | Gère sa propre fiche société, ses agents, sa facturation, et les résidences dont elle a la gestion |
| **Agent** | Collaborateur rattaché à une agence | Même périmètre de résidences que son agence, mais sans les actions les plus sensibles (facturation, gestion des agents, validation d'identité, suppression de compte) |
| **Résident/bailleur** | Utilisateur de l'app mobile uniquement | N'a jamais accès au backoffice |

Un compte Agence ou Agent ne voit que les résidences rattachées à sa gérance. Les Super Admin voient l'ensemble.

### 1.2 Grandes fonctions couvertes

- Tableau de bord de pilotage (statistiques et indicateurs)
- Gestion des sinistres déclarés par les résidents
- Planification et suivi des interventions de prestataires
- Publication de communications (actualités) aux résidents
- Gestion des résidences, bâtiments et lots
- Validation d'identité et gestion des résidents
- Gestion des agences partenaires (syndics, gérances) et de leurs agents
- Annuaire des prestataires et contacts d'urgence
- Gestion documentaire (résidence et lot)
- Facturation des licences agences
- Campagnes publicitaires diffusées dans l'app mobile

---

## 2. Connexion et compte

### 2.1 Connexion (`/login`)
Connexion par email/mot de passe ou via un compte Google. Un lien « mot de passe oublié » permet de recevoir un email de réinitialisation ; pour des raisons de confidentialité, le même message de confirmation s'affiche que l'adresse existe ou non dans la base.

### 2.2 Inscription (`/register`)
La création d'un compte ne donne, à elle seule, aucun accès au backoffice. Un compte nouvellement créé doit être promu manuellement (par un Super Admin, en base) à un rôle Agence/Agent/Super Admin avant de pouvoir se connecter au backoffice.

### 2.3 Réinitialisation du mot de passe (`/reset-password`)
Page atteinte depuis le lien reçu par email, permettant de définir un nouveau mot de passe.

### 2.4 Profil personnel (`/profil`)
Chaque utilisateur peut modifier sa photo de profil, son téléphone, et selon son rôle :
- **Agence** : le nom de la société n'est pas modifiable ici (limité à 20 caractères), le champ « Responsable légal » remplace prénom/nom, avec un outil de recherche SIRET/SIREN pour pré-remplir les informations.
- **Agent/Super Admin** : prénom et nom classiques.

Les comptes Agence/Agent voient également un rappel de leur gérance de rattachement (adresse, département, services actifs, nombre de résidences gérées).

---

## 3. Tableau de bord (`/`)

Page d'accueil du backoffice, avec message de bienvenue personnalisé (prénom pour un compte individuel, nom de la gérance pour Agence/Agent).

Deux filtres s'appliquent à l'ensemble de la page : une **résidence** (ou toutes) et une **plage de dates**.

### 3.1 Indicateurs Sinistres
- Délai moyen de prise en charge (temps entre la déclaration et le passage « En cours »)
- Délai moyen de résolution (temps entre la déclaration et la clôture)
- Nombre de sinistres actifs (non terminés) et de sinistres urgents (actifs + priorité haute)
- Répartition des sinistres par statut et par priorité
- Évolution mensuelle des déclarations
- *(Bloc « respect des délais par niveau de priorité » : fonctionnalité annoncée mais pas encore active, en attente de seuils configurables)*

### 3.2 Indicateurs Interventions
- Interventions prévues sous 7 jours
- Délai moyen entre création et intervention programmée
- Nombre créées / clôturées et taux de clôture
- Nombre et proportion d'interventions reprogrammées par les prestataires
- Classement des prestataires qui reprogramment le plus

### 3.3 Indicateurs Résidences & Utilisateurs
- Nombre de résidences, d'utilisateurs (avec badge « en attente » réservé aux Super Admin)
- Nombre de propriétaires et locataires uniques
- Évolution du taux de remplissage (propriétaires inscrits rapporté au nombre total de lots)

### 3.4 Indicateurs Contacts
- Nombre total de contacts, taux de fiches complètes, contacts en attente d'approbation, doublons potentiels détectés, part des résidences sans aucun contact

---

## 4. Sinistres

Module regroupant les signalements de sinistre déclarés par les résidents depuis l'app mobile.

### 4.1 Statuts d'un sinistre
- **Non envoyé** *(« À venir » côté app)*
- **Transmis** *(« À traiter »)*
- **En cours**
- **Terminé**

Deux champs sont propres au backoffice et invisibles côté résident :
- **Priorité** : basse / normale / haute
- **Archivé** : permet de masquer un ticket terminé du tableau Kanban sans changer son statut réel

### 4.2 Vue Kanban (`/sinistres/kanban`)
Une colonne par statut. Glisser-déposer une carte d'une colonne à l'autre change le statut du ticket. Chaque carte affiche une vignette photo, le titre, la résidence, la date, la priorité (modifiable directement), le nombre de déclarations liées (doublons détectés pour un même événement) et le nombre de commentaires.

**Règle importante** : faire sortir un ticket du statut « Non envoyé » revient à le déclarer officiellement (pose la date de déclaration) — une confirmation est demandée car cette action est **irréversible** : un ticket déclaré ne peut plus jamais repasser à « Non envoyé ».

Sur mobile, le glisser-déposer est désactivé (les colonnes s'empilent, l'ouverture se fait au clic).

### 4.3 Vue Liste (`/sinistres/liste`)
Quatre indicateurs cliquables (Total, Transmis, En cours, Terminé) filtrent la liste. Colonnes : numéro de ticket, photo, titre, résidence, date de déclaration, nombre de déclarations liées, statut, priorité, actions.

Un filtre « Afficher les tickets archivés » et un filtre « Afficher les tickets non déclarés » complètent la recherche par texte, résidence et période.

### 4.4 Fiche détail d'un sinistre
Affiche l'ensemble des informations : résidence, date de première déclaration, date de prise en charge, statut et priorité modifiables, date d'intervention programmée le cas échéant (avec lien vers l'intervention), photos et vidéos de toutes les déclarations liées, ainsi qu'une fiche par déclarant (nom, lot, contact, statut résident, description du problème) — utile lorsque plusieurs résidents signalent le même événement.

Actions disponibles :
- **Programmer une intervention** : ouvre le formulaire d'intervention pré-rempli avec le titre et la localisation du sinistre. Dès qu'une intervention est programmée, le sinistre passe automatiquement en « En cours » (sauf s'il l'est déjà, ou s'il n'a pas encore été déclaré). Cette action est indisponible si le ticket est déjà terminé ou déjà lié à une intervention.
- **Exporter en PDF** : génère un rapport complet (logo, détails, déclarants, photos, commentaires).
- **Archiver / Désarchiver**.
- Navigation précédent/suivant vers les autres sinistres de la liste, fil de commentaires avec réponses.

---

## 5. Interventions

Module de planification des passages de prestataires (dépannage, entretien, sinistre à traiter...).

### 5.1 Statuts d'une intervention
- **Programmé** *(cas par défaut)*
- **Terminé** : un compte-rendu a été soumis par le prestataire
- **Reporté** : le prestataire a reprogrammé sa venue depuis son lien d'accès dédié
- **Annulé** : annulée manuellement depuis le backoffice

### 5.2 Vue Liste (`/evenements/liste`)
Trois indicateurs cliquables (Total, En cours, Terminées). Colonnes : titre, résidence, date, heure, prestataire, description, statut, actions.

### 5.3 Vue Calendrier (`/evenements/calendrier`)
Quatre cartes de synthèse (interventions du jour, interventions programmées à venir groupées par jour, interventions reprogrammées, résidences concernées par une intervention à venir), puis une grille calendrier mensuelle avec code couleur par statut (vert = programmé, gris = terminé, orange = reporté, rouge = annulé).

### 5.4 Fiche détail d'une intervention
Affiche la résidence, le prestataire, la date/heure, le sinistre lié le cas échéant, la description, et la liste des comptes-rendus déposés par le prestataire.

Actions disponibles :
- **Envoyer** : identifie l'email du prestataire choisi et lui envoie un email contenant un lien d'accès sécurisé (valable jusqu'à 48h après la date d'intervention), lui permettant de consulter l'intervention, la reprogrammer ou déposer un compte-rendu sans avoir de compte. Indisponible si l'intervention est déjà annulée ou reportée.
- **Modifier** : ouvre le formulaire d'édition ; si l'intervention a déjà été reportée par le prestataire, seule l'annulation reste possible (le reste devient en lecture seule).
- **Annuler l'intervention** : au choix, annuler uniquement cette intervention, ou toute la chaîne d'interventions liées par des reprogrammations successives.

### 5.5 Créer/modifier une intervention
Formulaire commun (accessible aussi via « Ajouter une intervention » sur la liste) : résidence, titre, date, heure (optionnelle), prestataire (liste des contacts de la résidence + contacts de la gérance rattachée), bâtiment et étage (optionnels, dépendants de la structure de la résidence), description.

---

## 6. Communication

Module de publication d'actualités à destination des résidents, visibles dans le fil de l'app mobile.

### 6.1 Liste (`/communications`)
Recherche par texte et par résidence. Une communication publiée simultanément sur plusieurs résidences apparaît comme une seule ligne dépliable indiquant le nombre de résidences concernées. Colonnes : titre (avec indication si l'audience est restreinte aux propriétaires), résidence, date de publication, nombre de commentaires, nombre de vues uniques.

### 6.2 Création
Formulaire : titre, description, destinataires (tous les utilisateurs ou uniquement les propriétaires), sélection d'une ou plusieurs résidences (avec option « Toutes les résidences »). La publication crée une copie du message dans chaque résidence sélectionnée.

### 6.3 Détail
Consultation de la communication (auteur, date, audience, statistiques) et de son fil de commentaires. Aucune modification ou suppression n'est proposée après publication.

---

## 7. Résidences

### 7.1 Liste (`/residences`)
- Nombre total de résidences, classement des villes les plus représentées, carte géographique des résidences (localisation automatique par adresse).
- Annuaire filtrable par nom, adresse, code postal, ville ou email de contact.
- **Ajout d'une résidence** : réservé aux Super Admin et aux Agences de type syndic (jamais aux Agents). Une résidence créée par une Agence lui est automatiquement rattachée.

### 7.2 Fiche détail d'une résidence
Quatre sections :

**Informations générales** : nom, adresse, code postal, ville, email de contact. Le rattachement à une gérance (qui détermine quel compte Agence/Agent a accès à la résidence) est réservé aux Super Admin.

**Conseil syndical** : liste des propriétaires éligibles (déduits des lots de la résidence) et des membres actuels du conseil. Invitation par email et retrait possibles, accessibles à tous les rôles ayant accès à la résidence.

**Structures et bâtiments** : liste réordonnable des bâtiments/parties de la résidence (bâtiment, villa, souterrain, jardin, parking, garage, cave, partie commune, extérieur...), avec génération automatique des étages, gestion des sous-sols, et description des équipements présents.

**Lots** : tableau éditable directement (sauvegarde automatique) listant chaque lot avec son bâtiment, numéro, référence, type (appartement, parking, cave, local commercial...), et son éventuel rattachement à un lot principal (un parking rattaché à un appartement, par exemple — le rattachement recopie automatiquement le propriétaire/locataire du lot principal). Un lot déjà attribué à un propriétaire ne peut plus être supprimé. Deux lots ne peuvent pas partager la même référence, ni la même combinaison bâtiment/numéro. Un **import en masse** via fichier Excel/CSV est disponible, avec détection des doublons avant validation.

---

## 8. Utilisateurs (résidents)

### 8.1 Liste (`/residents`)
Indicateurs (réservés Super Admin) : total, en attente d'approbation, comptes approuvés. La liste est filtrée aux résidents dont un lot appartient au périmètre de résidences de l'utilisateur connecté (Agence/Agent). Colonnes : nom, email, date de la demande, statut (approuvé / refusé / en attente).

### 8.2 Fiche détail d'un résident
**Validation d'identité** (réservée Super Admin) : approuver, révoquer ou refuser l'identité d'un résident (un refus impose la saisie d'un motif, communiqué au résident dans l'app). **Un compte refusé voit sa fiche entièrement gelée** : plus aucune modification (identité, téléphone, lots) n'est possible tant que le résident n'a pas resoumis son inscription depuis l'application.

Les informations d'identité (prénom, nom, date de naissance, sexe, nationalité, lieu de naissance) ne sont modifiables que par un Super Admin. Le téléphone reste modifiable par une Agence/Agent même si le reste de la fiche est verrouillé.

La pièce d'identité déposée (recto/verso) n'est visible que par un Super Admin.

**Suppression du compte** (réservée Super Admin) : action irréversible, supprime le compte ainsi que toutes ses données associées (documents, lots, annonces, commentaires...), avec une confirmation détaillant tout ce qui sera effacé.

**Gestion des lots** : une fois l'identité approuvée, la fiche affiche chaque lot rattaché au résident (résidence, bâtiment, numéro, statut propriétaire/locataire) avec un bouton d'approbation réservé aux Super Admin et aux Agences (pas aux Agents). Les lots liés automatiquement (lots groupés, lots supplémentaires demandés à l'inscription) et les documents déposés pour chaque lot sont également listés.

---

## 9. Agences

Le contenu de cette page dépend du rôle connecté.

### 9.1 Vue Super Admin — Répertoire des agences (`/agences`)
Indicateurs cliquables (professionnels, syndics, gérances locatives), recherche, et table listant chaque agence avec ses services actifs et son contact principal.

**Création/édition d'une agence** : recherche par SIRET/SIREN/nom pour pré-remplir automatiquement les informations légales de la société, puis activation des services (Syndic et/ou Gérance locative — désactivable uniquement si aucun compte actif n'y est rattaché), email et téléphone par service, statut du compte (invité/actif/révoqué), et gestion des agents nommés (invitation, révocation — chaque invitation ajoute un siège facturé). Un résumé de la licence (statut, sièges achetés/attribués/disponibles) est affiché.

### 9.2 Vue Agence/Agent — Ma fiche agence
Chaque compte Agence ne voit et ne modifie que sa propre fiche (jamais l'annuaire complet) :
- Informations générales (modifiables par l'Agence uniquement, lecture seule pour l'Agent)
- Rappel de l'abonnement, avec accès à la facturation (réservé à l'Agence)
- Une carte par service actif avec téléphone modifiable et gestion des agents nommés

---

## 10. Contacts (annuaire prestataires)

### 10.1 Liste (`/contacts`)
- **Détection de doublons** : contacts au nom similaire présents sur des résidences différentes, avec actions « Pas un doublon » ou « Fusionner » (transfère toutes les résidences vers le contact conservé).
- Indicateurs : total, en attente d'approbation, approuvés.
- Table : nom, service, téléphone, email, résidences concernées, statut, actions (approuver, modifier, supprimer).
- **Numéros d'urgence nationaux** (réservé Super Admin) : liste indépendante des résidences (urgence / sécurité), gestion complète.

### 10.2 Créer/modifier un contact
Nom, service (nettoyage, espaces verts, électricité, ascenseur, chauffage collectif, plomberie, VMC, portes et portails, vidéosurveillance, sécurité incendie, gestion administrative, toiture/étanchéité), téléphone, email, adresse, site web, résidences rattachées (sélection multiple).

---

## 11. Documents (`/documents`)

### 11.1 Documents de résidence
Filtrables par résidence et catégorie (gestion du syndic, assemblées générales, contrats et marchés, assurances, carnet d'entretien, synthèse et fiches officielles, documents juridiques). Ajout d'un document : résidence, catégorie, nom, fichier (PDF/JPG/PNG).

### 11.2 Documents de lot
Sélection en cascade résidence puis lot. Catégories propres au lot (appel de fonds, quittance de loyer, bail, justificatif, autre) avec des destinataires par défaut selon la catégorie (un appel de fonds cible par défaut les propriétaires, une quittance de loyer les locataires, un bail les deux). L'ajout est bloqué si le lot n'a ni propriétaire ni locataire rattaché.

---

## 12. Facturation (`/facturation`)

Réservée aux comptes **Agence** (un Agent n'y a pas accès).

Affiche le statut d'abonnement (essai, actif, paiement en retard, annulé, impayé), le nombre de sièges souscrits, le prix par licence, le total facturé, la date de renouvellement, la liste des comptes facturés (agents + agence), le moyen de paiement enregistré et l'historique des factures. Un bouton permet de s'abonner ou de gérer l'abonnement existant via le portail de paiement en ligne.

---

## 13. Publicités (`/publicites`)

Réservé aux **Super Admin**.

### 13.1 Liste
Réglage global de la fréquence d'affichage des publicités dans le fil de l'app. Indicateurs : campagnes actives, impressions cumulées, clics, taux de clic moyen. Table des campagnes avec statut, résidences ciblées, période, performance.

**Statuts d'une campagne** :
| Situation | Statut |
|---|---|
| Dates non renseignées | Dates à renseigner |
| Avant la date de début | Programmée |
| Après la date de fin | Terminée |
| En période, quota respecté | Active |
| En période, quota de campagnes actives atteint pour le département (3 max) | En attente |

Le passage au statut « Active » est calculé automatiquement (pas de contrôle manuel).

### 13.2 Créer/modifier une campagne
Nom, lien cible (optionnel), image carrée, période de diffusion, ciblage (France entière ou sélection de départements).

### 13.3 Rapport de campagne
Consultable depuis la fiche détail, exportable en PDF : temps de campagne consommé, impressions/clics cumulés et par région, évolution dans le temps (jour/mois/année), et répartition de l'engagement par profil de résident (propriétaire/locataire), comptée en utilisateurs uniques.

---

## 14. Pages accessibles sans connexion

### 14.1 Partage prestataire (`/partage/:token`)
Lien envoyé par email à un prestataire lors de l'envoi d'une intervention, sans nécessiter de compte. Le prestataire peut consulter l'intervention (et le détail du sinistre lié le cas échéant), la reprogrammer à une nouvelle date (ce qui génère un nouveau lien et marque l'ancienne intervention comme reportée), ou déposer un compte-rendu (titre, description, photo obligatoire). Le lien devient inutilisable une fois le compte-rendu soumis.

### 14.2 Offre commerciale (`/offre/:token`)
Page envoyée par email lors de l'invitation d'un agent nécessitant un paiement de licence. Affiche la gérance concernée, le service, le prix, un sélecteur du nombre de licences et redirige vers le paiement en ligne. Après paiement, un lien de définition de mot de passe est généré pour créer le compte.

---

## 15. Navigation

La barre latérale donne accès à : Tableau de bord, Sinistres (Kanban/Liste), Interventions (Calendrier/Liste), Communication, Résidences, Utilisateurs (avec pastille indiquant le nombre de comptes en attente), Agences (masquée pour les Agents), Contacts, Documents, et Publicités (Super Admin uniquement). Le menu du compte, en bas de la barre latérale, donne accès au Profil, à la Facturation (Agence uniquement) et à la déconnexion.

---

## 16. Points notés comme non finalisés

- Le bloc « Respect des délais par niveau de priorité » du tableau de bord est affiché mais non actif : les seuils de délai par priorité ne sont pas encore configurables.
- La gestion des résidences n'est pleinement disponible que pour le périmètre des gérances de type « Syndic » ; le périmètre des gérances de type « Gérance locative » n'a pas encore de vue résidence dédiée dans le backoffice.
