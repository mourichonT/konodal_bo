# Documentation fonctionnelle — Backoffice Konodal

*Dernière mise à jour : 2026-11-08*

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

Un compte Agence ou Agent ne voit que les résidences rattachées à sa gérance. Les Super Admin voient l'ensemble. L'approbation d'un lot revient à Konodal (Super Admin) : une Agence ou un Agent suit les demandes de son portefeuille sans pouvoir les approuver.

Le backoffice est servi sur **portail.konodal.com** ; konodal.com/portail y redirige. Une Agence ou un Agent sans gérance voit « Votre accès au backoffice est suspendu. »

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
- Facturation des licences agences et de l'option CS avancé des résidences
- Campagnes publicitaires diffusées dans l'app mobile
- Votes et assemblées générales
- Assistant Nodo et sa base de connaissances
- Modération des contenus signalés depuis l'app
- Demandes de résidence, demandes de retrait d'un résident et unification des comptes en doublon

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

Le Super Admin dispose de deux onglets, « Opérationnel » et « Financier » (section 3.5). Une Agence ou un Agent ne voit que le premier, sans barre d'onglets. Deux filtres s'appliquent à l'onglet Opérationnel : une **résidence** (ou toutes) et une **plage de dates**.

### 3.1 Indicateurs Sinistres
- Délai moyen de prise en charge (temps entre la déclaration et le passage « En cours »)
- Délai moyen de résolution (temps entre la déclaration et la clôture)
- Nombre de sinistres actifs (non terminés) et de sinistres urgents (actifs + priorité haute)
- Répartition des sinistres par statut et par priorité
- Évolution mensuelle des déclarations
- *(Bloc « Respect des délais par niveau », badge « À finaliser » : fonctionnalité annoncée mais pas encore active, en attente de seuils configurables)*

### 3.2 Indicateurs Interventions
- Interventions prévues sous 7 jours
- Délai moyen entre création et intervention programmée
- Nombre créées / clôturées et taux de clôture
- Nombre et proportion d'interventions reprogrammées par les prestataires
- Classement des prestataires qui reprogramment le plus

### 3.3 Indicateurs Résidences & Utilisateurs
- Nombre de résidences ; nombre d'utilisateurs (indicateur réservé aux Super Admin)
- Nombre de propriétaires et locataires uniques
- Évolution du taux de remplissage (propriétaires inscrits rapporté au nombre total de lots)

### 3.4 Indicateurs Contacts
- Nombre total de contacts, taux de fiches complètes, contacts en attente d'approbation, doublons potentiels détectés, part des résidences sans aucun contact

### 3.5 Onglet Financier (Super Admin)
De haut en bas :
- **Synthèse** : CA réalisé de l'année, CA mensuel actuel, clients payants, impayés, CA prévisionnel mensuel et annuel, licences et résidences CS avancé à activer.
- **Prévisionnel** : graphique et tableau « Activations à venir » (date, client, offre, origine, volume, CA mensuel).
- **Licences** : licences actives, agences abonnées, MRR, revenu moyen, encaissé sur 30 jours, factures impayées, résiliations programmées, désabonnements sur 30 jours, graphiques et détail par agence.
- **Option CS avancé** : indicateurs équivalents, graphiques et liste des résidences.

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
Quatre indicateurs cliquables (Total, À traiter, En cours, Terminé) filtrent la liste. Colonnes : numéro de ticket, photo, titre, résidence, date de déclaration, nombre de déclarations liées, statut, priorité, actions.

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

Module de communication vers les résidents, en deux sous-pages :
- **Fil d'actualité** (`/communications/fil`) : posts publiés dans le fil de l'app des résidences choisies. Ouvert aux agences et agents pour les résidences de leur portefeuille, et au Super Admin pour toutes les résidences (sections 6.1 à 6.3).
- **Chat Konodal** (`/communications/chat`) : messages de la conversation officielle « Konodal » dans la messagerie de l'app. Réservé au Super Admin : une agence ou un agent ne voit pas cette sous-page et ne peut pas y écrire (section 6.4).

Pour une agence ou un agent, le menu « Communication » mène directement au fil d'actualité.

### 6.1 Liste (`/communications/fil`)
Recherche par texte et par résidence. Une communication publiée simultanément sur plusieurs résidences apparaît comme une seule ligne dépliable indiquant le nombre de résidences concernées. Colonnes : titre (avec indication si l'audience est restreinte aux propriétaires), résidence, date de publication, nombre de commentaires, nombre de vues uniques.

### 6.2 Création
Formulaire : titre, description, lien (optionnel), photo (optionnelle : JPG, PNG, WebP ou GIF, 10 Mo max, affichée sous le texte dans l'app ; pas de vidéo), destinataires (tous les utilisateurs ou uniquement les propriétaires), sélection d'une ou plusieurs résidences (avec option « Toutes les résidences »), publication maintenant ou programmée (date et heure). La publication crée une copie du message dans chaque résidence sélectionnée.

**Publication programmée** : la communication est enregistrée avec sa date et son heure, et le serveur la publie automatiquement à l'heure prévue (à la minute près). Rien n'est visible dans l'app avant, et les résidents sont notifiés au moment de la publication. Les communications en attente apparaissent dans la carte « Programmées » de la liste, de la plus proche à la plus lointaine, avec deux actions : « Changer l'heure » et « Annuler la publication » (la communication et sa photo sont supprimées). Pour une communication envoyée à plusieurs résidences, ces actions s'appliquent à toutes ses copies.

### 6.3 Détail
Consultation de la communication (auteur, date, audience, statistiques, photo ou visuel publié dans l'app) et de son fil de commentaires, où l'on peut commenter, répondre et supprimer ses propres commentaires. La communication elle-même n'est ni modifiable ni supprimable sur cette page ; un Super Admin peut la supprimer depuis Contenus > Posts (section 16).

### 6.4 Chat Konodal (`/communications/chat`, Super Admin)
Conversation officielle « Konodal » de la messagerie de l'app, présentée comme un compte vérifié (logo K, badge), pour annoncer des nouveautés ou des fonctionnalités. Elle est commune à tous les comptes : il n'y a ni destinataire ni résidence à choisir, et chaque message publié est visible par tous. Elle est en lecture seule : les résidents ne peuvent pas répondre.

**Liste** : brouillons en haut, puis messages publiés du plus récent au plus ancien. Pour chacun : titre et début du texte (avec une icône s'il y a une photo, une vidéo ou un bouton), statut (Brouillon, Publié, Retiré), date de publication et état de la notification (sans notification, à la publication, en cours d'envoi, ou envoyée avec le nombre d'envois et d'échecs).

**Création et modification** : titre (titre de la bulle, aperçu dans la liste des conversations et texte de la notification), texte (700 caractères), photo ou vidéo facultative (photo JPG, PNG, WebP ou GIF jusqu'à 10 Mo ; vidéo MP4 ou MOV jusqu'à 100 Mo ; un avertissement s'affiche pour un MOV, souvent illisible sur Android et dans la webapp quand il vient d'un iPhone), bouton facultatif (texte et lien http ou https, affiché seulement si les deux sont renseignés), et case « Envoyer une notification Konodal à tous les comptes résidents ». Un aperçu de la bulle s'affiche à côté du formulaire. On peut enregistrer un brouillon (invisible dans l'app) ou publier. Une publication avec notification demande une confirmation, car la notification ne peut pas être annulée.

**Règles** :
- La notification ne part qu'une fois, à la première publication. La case ne se modifie plus ensuite.
- Modifier un message publié change la bulle immédiatement chez tous les résidents, sans la déplacer dans la conversation.
- « Retirer » enlève le message de la conversation de tous les comptes, et il reste dans le BO. « Republier » le remet en bas de la conversation, sans nouvelle notification.
- « Supprimer » efface le message et son média, définitivement.

---

## 7. Résidences

### 7.1 Liste (`/residences`)
- Nombre total de résidences, classement des villes les plus représentées, carte géographique des résidences (localisation automatique par adresse).
- Annuaire filtrable par nom, adresse, code postal, ville ou email de contact.
- **Ajout d'une résidence** : réservé aux Super Admin et aux Agences de type syndic (jamais aux Agents). Une résidence créée par une Agence lui est automatiquement rattachée.

### 7.2 Fiche détail d'une résidence
Six onglets : Tableau de bord (ouvert par défaut), Information, Configuration, Configuration des lots, Votes & assemblées générales et, pour le Super Admin, Facturation.

**Tableau de bord** : les mêmes indicateurs que le tableau de bord du conseil syndical dans l'app, ouverts à tous les rôles qui ont accès à la résidence (Super Admin, Agence, Agent), en lecture seule. Les chiffres portent sur les 12 derniers mois et sont calculés à l'ouverture de l'onglet ; « Actualiser » les recalcule. Ils sont regroupés en quatre blocs :
- **Résidence** : part des lots d'habitation avec un occupant inscrit, par bâtiment ; portée des communications du CS (part des résidents qui les ont vues) ; participation aux votes en tantièmes, ou en lots quand les tantièmes ne sont pas renseignés.
- **Sinistres** : sinistres en attente chez le syndic (transmis ou en cours), avec ceux de priorité haute et ceux qui attendent depuis plus de 30 jours ; points noirs, c'est-à-dire les lieux qui cumulent le plus de déclarants.
- **Syndic** : délai médian de traitement d'un sinistre, en jours ouvrés, de la transmission à la clôture ; délai médian de réponse aux mails des résidents et messages sans réponse après 7 jours (seulement des chiffres, jamais le contenu des mails).
- **Prestataires** : prestataires dont des interventions ont été reprogrammées ou sont restées sans compte-rendu.

Un sinistre, une communication ou un vote de la liste ouvre sa fiche.

**Information** : nom, adresse, code postal, ville, email de contact et adresses alternatives. Le rattachement à une gérance (qui détermine quel compte Agence/Agent a accès à la résidence) est réservé aux Super Admin. La carte **Conseil Syndical** liste les propriétaires éligibles (déduits des lots de la résidence, avec recherche) et les membres actuels ; invitation par email et retrait possibles, accessibles à tous les rôles ayant accès à la résidence. « Inviter au CS » est désactivé pour un résident à l'accès restreint. Une Agence ou un Agent voit aussi la carte **Option CS avancé** (statut, « Souscrire pour la résidence » ou « Gérer l'abonnement »). Le Super Admin voit la carte **Charte & règles de vie** (version en vigueur, signatures, PDF des signataires) et **Supprimer la résidence** : bilan préalable, saisie du nom exact, suppression bloquée si un abonnement CS avancé est en cours.

**Configuration** : liste réordonnable des **structures et bâtiments** (bâtiment, villa, souterrain, jardin, parking, garage, cave, partie commune, extérieur...), avec génération automatique des étages, gestion des sous-sols, et description des équipements présents. Une case à cocher par niveau (RDC, étages, sous-sols) choisit les niveaux proposés dans la liste des étages (sinistres, interventions) : un niveau décoché, comme le RDC d'un souterrain, n'est plus proposé. À l'import des lots, un bâtiment dont tous les lots sont sous le RDC (un souterrain) est créé sans RDC. La carte **Sécurité & accès** donne une ligne pour le portail de la résidence et une par bâtiment (type, code, précisions), enregistrée automatiquement et affichée au prestataire sur son lien d'intervention.

**Configuration des lots** : tableau éditable directement (sauvegarde automatique) listant chaque lot avec son bâtiment, numéro, référence, type (appartement, parking, cave, local commercial...), tantièmes, caractère rattachable et son éventuel rattachement à un lot principal (un parking rattaché à un appartement, par exemple — le rattachement recopie automatiquement le propriétaire/locataire du lot principal). Un lot déjà attribué à un propriétaire ne peut plus être supprimé. La case **Masqué** retire un lot de l'app (lots d'un bailleur social à la gestion distincte, par exemple) : il n'est plus proposé à l'inscription ni listé, mais reste compté dans les votes. Quand tous les lots d'un bâtiment sont masqués, ce bâtiment n'est plus proposé dans les déclarations et ses sinistres et incivilités ne remontent plus dans l'app ; ils restent visibles au BO. Deux lots ne peuvent pas partager la même référence, ni la même combinaison bâtiment/numéro. Un **import en masse** via fichier Excel/CSV est disponible, avec détection des doublons avant validation.

**Votes & assemblées générales** : voir la section 7.5.

**Facturation** (Super Admin) : voir la section 7.6.

### 7.3 Demandes de résidence (`/residences/demandes`, Super Admin)
Demandes reçues du formulaire konodal.com/inscription-residence, en offre gratuite. Indicateurs cliquables (en attente, validées, refusées) et délai moyen de traitement. Colonnes : date, résidence, ville, demandeur, lots, statut, actions ; demandes en attente en tête.

La fiche a cinq onglets : Information, Bâtiments, Lots, Documents, Échanges.
- **Information** : coordonnées modifiables tant que la demande est en attente, demandeur et décision.
- **Valider et créer la résidence** crée la résidence, ses bâtiments et ses lots (tantièmes à 0, sans syndic) ; le demandeur devient membre du conseil syndical et reçoit un mail. La validation est impossible sans compte Konodal lié.
- **Refuser** : motif facultatif, envoyé au demandeur.
- **Documents** : ouverture et ajout de documents.
- **Échanges** : « Écrire au demandeur » depuis support@konodal.com, avec l'historique des messages.

### 7.4 Fiche lot (`/residences/:id/lots/:lotId`)
Informations du lot, cartes Propriétaire et Locataire (destination du bien, type de bail) et « Voir la fiche » du résident. Ajouter un résident (avec justificatif optionnel), le révoquer et détacher une dépendance sont réservés au Super Admin. Un résident à l'accès restreint porte un badge.

**Crédits Nodo** (Super Admin) : crédits consommés ce mois-ci sur le pot du lot (150 crédits par mois, communs à ses occupants), puis, pour chaque occupant, ses crédits du mois sur sa limite de 100, toutes résidences confondues. Une dépendance rattachée affiche le pot de son logement. 1 crédit correspond à une question moyenne posée à Nodo dans l'app.

### 7.5 Votes et assemblées générales
Liste : titre, type (Assemblée générale ou Sondage), statut (En attente de lancement, En cours, En pause, Ouvert, Clos), date de création. Un vote se supprime tant qu'il n'est pas clos.

**Création** :
- **Sondage** : titre, question, au moins 2 options, durée avant clôture en heures (24 par défaut).
- **Assemblée générale** : titre, description et questions. Chaque question a ses options (Pour / Contre / Abstention pré-remplies), sa majorité légale (article 24, 25 par défaut, 26, unanimité), sa durée en secondes (30 au minimum) et, pour les articles 25 et 26, la passerelle 25-1 / 26-1 (cochée par défaut). Une assemblée est bloquée tant qu'aucun tantième n'est renseigné sur les lots.

**Déroulé d'une assemblée** : avant le lancement, le quorum de présence émargée s'affiche, puis « Lancer la session ». Les questions sont lancées une par une, avec compte à rebours et barres en tantièmes ; « Mettre en pause » / « Reprendre » et « Passer » restent disponibles. Chaque résultat indique Adoptée, Rejetée ou Passerelle, ainsi que le nombre de lots n'ayant pas répondu et leurs tantièmes.

### 7.6 Onglet Facturation (Super Admin)
Gestion de l'option CS avancé de la résidence :
- **Option CS avancé** : statut, formule, mode de paiement, lots facturés et lots de la résidence, prochaine échéance, remise, frise des jalons. Le menu Actions ouvre la page de souscription ou de gestion, copie un lien de changement de carte ou d'IBAN (valable 24 h), passe à l'annuel, résilie à la fin de la période ou annule la résiliation, et ouvre Stripe.
- **Remise et code promo** : code promo Stripe ou mois offerts (3, 6, 12, 24), appliqués tout de suite à un abonné ou réservés pour la souscription.
- **Offre** : sans abonnement, offrir l'option jusqu'à une date (+3, 6, 12, 24 mois ou sans fin) avec un motif, ou repasser en gratuit ; en essai, déplacer ou terminer la période offerte.
- **Factures** : date, numéro, période, montant, statut, PDF, lien de paiement, renvoi.
- **Syndicat des copropriétaires** : nom, email, adresse et SIRET figurant sur les factures. Pré-rempli « SDC <résidence> c/o <gérance> » avec l'adresse de la gérance et l'email de son service syndic. Permet un abonnement annuel sur facture (virement sous 30 jours) quand ces informations sont complètes.
- **Historique** : 100 derniers événements.

---

## 8. Utilisateurs (résidents)

### 8.1 Annuaire (`/residents`)
Indicateurs : Total utilisateurs, Lot validé, À traiter (Super Admin) ou En cours de validation (Agence/Agent), et Certification à vérifier (Super Admin). Ils suivent la recherche, la résidence et les dates ; un clic sur une carte ne filtre que la liste. La liste comprend, pour une Agence ou un Agent, les résidents ayant un lot approuvé ou une demande en cours dans son portefeuille. Colonnes : nom, email, résidence(s), date de la demande, statut (À traiter ou En cours de validation, Validé, ID confirmée, Inscrit, Bloqué), actions. Un résident à l'accès restreint porte un badge « Accès restreint ».

### 8.2 Fiche détail d'un résident
En-tête avec statut et, pour le Super Admin, **Approuver l'identité**, **Bloquer** (motif obligatoire, communiqué au résident dans l'app) et **Supprimer**. Une colonne « À traiter » renvoie vers ce qui attend une décision. En dessous, le Super Admin voit les **crédits Nodo** de la personne : consommés ce mois-ci sur sa limite de 100, toutes résidences confondues, et, avec une seconde barre, le nombre de questions posées dans la journée sur le quota journalier de 3 (compté en questions, quel que soit leur coût ; non bloquant : au-delà, la barre passe en orange et un avertissement s'affiche une fois dans l'app). Le compteur du jour repart de zéro chaque jour à 00h00 (heure de Paris) et la carte se recharge d'elle-même si la page reste ouverte. Trois onglets : Profil, Lots, Échanges. **Un compte bloqué voit sa fiche entièrement gelée** : plus aucune modification (identité, téléphone, lots) n'est possible tant que le résident n'a pas resoumis son inscription depuis l'application.

**Suppression du compte** (réservée Super Admin) : action irréversible, supprime le compte ainsi que toutes ses données associées (documents, lots, annonces, commentaires...), avec une confirmation détaillant tout ce qui sera effacé.

**Profil** : les informations d'identité (prénom, nom, date de naissance, sexe, nationalité, lieu de naissance) ne sont modifiables que par un Super Admin. Le téléphone reste modifiable par une Agence/Agent même si le reste de la fiche est verrouillé. La pièce d'identité déposée n'est visible que par un Super Admin. Le Super Admin voit aussi l'alerte de doublon de compte, les comptes déjà fusionnés et la carte « Accès restreint » avec « Lever la restriction », qui ne rend pas le rôle au conseil syndical.

**Certification d'identité** (Super Admin) : recto, verso, selfie, score de ressemblance et informations lues. « Certifier l'identité » ou « Refuser » (motif obligatoire, affiché au résident) ; « Certifier manuellement » et « Retirer la certification » hors demande en cours. Une pièce d'exemple ou fictive déclenche l'alerte « Pièce d'identité suspecte », pré-remplit le motif de refus et demande une confirmation « Certifier quand même ». Le selfie est supprimé dès la décision, la pièce 30 jours après.

**Lots** : chaque lot rattaché au résident (résidence, bâtiment, numéro, statut propriétaire/locataire), avec son état : Approuvé, En attente de l'occupant ou En attente. **Approuver**, **Révoquer**, **Détacher** et **Ajouter un lot** sont réservés au Super Admin. Une Agence ou un Agent suit les lots de son portefeuille sans les justificatifs. Pour le Super Admin :
- Validation automatique : un lot validé sans le backoffice porte « Validé automatiquement » ; une demande restée manuelle affiche le motif.
- **Analyse du justificatif** : lecture automatique du document, comparaison avec la demande, proposition de correction à appliquer et brouillon de mail à relire. « Relancer l'analyse » est possible.
- Justificatif d'exemple ou fictif (« SPÉCIMEN »…) : carte en rouge, badge « Justificatif suspect », mentions relevées, brouillon de mail demandant l'original et confirmation « Approuver quand même ».
- Lots supplémentaires demandés à l'inscription : cases à cocher, les écarts avec le backoffice (dépendance rattachée ailleurs, autre propriétaire, absente des lots groupés) sont signalés et décochés.
- **Détacher** une dépendance : la laisser libre (propriétaires et locataires hérités retirés) ou la rattacher à un autre lot.

**Échanges** : mails Konodal et réponses de l'utilisateur, messages avec le syndic. « Écrire » envoie un mail depuis support@konodal.com ; « Répondre » est proposé sur une réponse de l'utilisateur ou un mail écrit depuis le backoffice. Une pastille bleue signale au Super Admin les réponses à lire, marquées lues à l'ouverture de l'onglet.

### 8.3 Demandes de retrait (`/residents/retraits`, Super Admin)
Demandes du conseil syndical visant un résident. Indicateurs : En attente, Accès restreints, Refusées. Motifs : Non-respect de la charte, Comportement irrespectueux, Spam / publicité, N'habite pas la résidence, Autre. La fenêtre de décision présente le résident, le demandeur, le motif, la description et les pièces jointes ; un refus peut porter un motif.

**Restreindre l'accès** vaut pour cette résidence uniquement : le résident garde la lecture de la résidence, de son lot et son vote, mais ne peut plus publier, commenter, réagir, participer, signaler ni écrire aux voisins ou au syndic. Rien n'est supprimé ; il est retiré du conseil syndical et voit dans l'app le bandeau « Votre accès a été restreint ». La restriction se lève depuis sa fiche.

### 8.4 Unificateur de comptes (`/residents/unificateur`, Super Admin)
Détection des comptes en doublon chaque nuit et à chaque inscription, relançable à la demande. Indicateurs : À valider, Écartées, Fusionnées. Chaque paire indique « Certain » ou « Probable » avec un score et les éléments communs (email, téléphone, lot, date de naissance, prénom, nom).

Le détail présente les deux comptes côte à côte, avec le compte à garder et le choix des valeurs différentes. « Fusionner » affiche un récapitulatif, puis désactive et archive le compte absorbé. « Ce ne sont pas les mêmes personnes » écarte la paire, qui ne revient que si l'email, le téléphone, le nom ou le prénom change. Un doublon ouvert bloque la validation automatique des lots.

---

## 9. Agences

Le contenu de cette page dépend du rôle connecté.

### 9.1 Vue Super Admin — Répertoire des agences (`/agences`)
Indicateurs cliquables (Total des professionnels de l'immo, Total des syndics, Total des agences), recherche, et table listant chaque agence (adresse, ville, services actifs, contact principal). La fiche s'ouvre sur `/agences/:id`, réservée au Super Admin : elle ajoute la consommation de Nodo (plafond modifiable), la migration de l'ancienne formule et une « Zone de danger » : la suppression, bloquée tant qu'une résidence, un bâtiment ou un lot reste rattaché, résilie immédiatement l'abonnement.

**Création/édition d'une agence** : recherche par SIRET/SIREN/nom pour pré-remplir automatiquement les informations légales de la société, puis activation des services (Syndic et/ou Gérance locative — désactivable uniquement si aucun compte actif n'y est rattaché), email et téléphone par service, statut du compte (invité/actif/révoqué), et gestion des agents nommés (invitation, révocation). Facturation par licences : une **licence service** (19,90 € HT/mois) par service souscrit, 2 au maximum, portée par le compte du service ; des **licences agent** (9,90 € HT/mois) achetées en stock, une par agent nommé. Inviter un agent prend une licence disponible ou en ajoute une au prorata (avec confirmation) ; révoquer un compte libère sa licence, qui reste achetée jusqu'à « Retirer ». Un agent dont la licence a été libérée reste listé dans son service (« Sans licence · aucun accès ») et compté dans les agents de l'en-tête, avec « Attribuer une licence » (licence libre, sinon ajoutée au prorata, avec confirmation) et « Supprimer ». Pas d'agent sur un service non souscrit, et aucun agent sans abonnement actif. La carte « Abonnement » affiche les licences service (attribuée, non attribuée, non souscrite) et agent (achetées, attribuées, disponibles), avec Ajouter / Retirer et l'accès au portail de paiement. Pendant l'essai, elle indique sa date de fin ; un Super Admin peut le **prolonger** (« Prolonger l'essai » : nouvelle date après la fin actuelle, 2 ans au plus à partir d'aujourd'hui, sans facture ni prorata).

### 9.2 Vue Agence/Agent — Page Agence (onglets Général, Équipe, Abonnement)
Chaque compte Agence ne voit et ne modifie que sa propre fiche (jamais l'annuaire complet) ; un Agent la consulte sans rien modifier et n'a pas l'onglet Abonnement.
- **Général** : informations de l'agence (« Modifier » les rend éditables), une carte par service avec son compte, son téléphone, son prix et la liste de ses agents (licence attribuée, invitation envoyée avec « Renvoyer », sans licence), l'invitation d'un agent en ligne (licences libres restantes ou ajout d'une licence au prorata, avec confirmation), un service non souscrit en carte « Ajouter » (invite le compte du service et ajoute sa licence), la carte Nodo et le résumé de l'abonnement.
- **Nodo répond aux copropriétaires** (carte de l'onglet Général, compte agence d'un syndic ; aussi sur la fiche agence du Super Admin) : désactivée par défaut et ouverte par Konodal ; un sous-réglage envoie les réponses de Nodo par mail à l'agence. Voir la section 11 bis.
- **Réponses dans l'application** (carte de l'onglet Général, compte agence ; aussi sur la fiche agence du Super Admin) : active ou coupe la réponse aux résidents depuis la page Messages. Activée par défaut.
- **Équipe** : agents, licences agent utilisées sur achetées, montant mensuel des licences agent, puis les mêmes cartes de service. La fiche d'un agent permet de **libérer sa licence** (il reste dans l'équipe, sans aucun accès au backoffice, et la licence redevient libre), de lui **attribuer une licence** (une licence libre, sinon une de plus au prorata) ou de le supprimer.
- **Abonnement** : voir la section 12.

---

## 10. Contacts (annuaire prestataires)

### 10.1 Liste (`/contacts`)
- **Détection de doublons** : contacts au nom similaire présents sur des résidences différentes, avec actions « Pas un doublon » ou « Fusionner » (transfère toutes les résidences vers le contact conservé).
- Indicateurs : total, en attente d'approbation, approuvés.
- Table : nom, service, téléphone, email, résidences concernées, statut, actions (approuver, modifier, supprimer).
- **Numéros d'urgence nationaux** (réservé Super Admin) : liste indépendante des résidences (urgence / sécurité), gestion complète.

### 10.2 Créer/modifier un contact
Nom, service (nettoyage, espaces verts, électricité, ascenseur, chauffage collectif, plomberie, VMC, portes et portails, vidéosurveillance, sécurité incendie, gestion administrative, toiture/étanchéité), téléphone, email, adresse, site web, résidences rattachées (sélection multiple).

### 10.3 Fiche contact (`/contacts/:id`)
Informations du contact, « Approuver » ou « Désapprouver », « Supprimer », et rattachements aux gérances et résidences.

---

## 11. Documents (`/documents`)

Gestion électronique des documents, pour tous les rôles dans leur périmètre.

### 11.1 Navigation et recherche
- **Recherche** (Ctrl K, 2 caractères minimum, toutes résidences) : nom, lot et mot du contenu, avec extrait surligné.
- **Colonne de gauche** : Corbeille, résidences (épinglées, récentes, toutes de A à Z), puis dans une résidence les documents de résidence, les bâtiments et les lots, avec leurs compteurs.
- **Vue d'ensemble** : non partagés (Super Admin), ajoutés cette semaine, nombre de documents, derniers ajouts et accès par catégorie.

### 11.2 Tableau
Filtres par catégorie, partage, étiquettes et dates ; vue liste ou grille ; sélection multiple. Actions : ouvrir la fiche, télécharger, mettre à la corbeille ; dans la corbeille, restaurer ou supprimer définitivement, avec confirmation. « Partager » et « Ne plus partager » sont réservés au Super Admin.

### 11.3 Fiche d'un document
- **Détails** : aperçu, nom, catégorie, rattachement, date du document, partage et étiquettes, enregistrés au fil de l'eau.
- **Accès** : Non partagé (Super Admin), Conseil syndical, Propriétaires, Toute la résidence, Occupants du bâtiment, ou lot partagé, avec une option de notification à la publication.
- **Journal** : historique du document, consultations comprises.

Un document **non partagé** n'est visible que des administrateurs Konodal et n'apparaît jamais dans l'app.

### 11.4 Import
Depuis une résidence, un bâtiment ou un lot : plusieurs fichiers par glisser-déposer (PDF, images, Word, ODT, Excel, texte), catégorie et partage. Par défaut, un document importé par un Super Admin est non partagé. Pour une Agence ou un Agent, les catégories Assemblées générales et Documents juridiques vont aux propriétaires, les autres à toute la résidence. Dans un lot, les destinataires sont cochés et l'ajout est bloqué si le lot n'a aucun occupant. Nodo renseigne ensuite la date du document et ses étiquettes.

Les pièces d'identité, justificatifs de domicile et Kbis n'apparaissent jamais dans les documents.

---

## 11 bis. Messages (`/messages`)

Boîte de réception sur trois colonnes, à la manière d'Outlook : les résidences à gauche (comme dans les Documents, avec leur nombre de messages), la liste des mails au milieu, le mail ouvert à droite. Elle réunit les messages écrits par les résidents à leur syndic depuis l'application et les réponses du syndic rapatriées de sa boîte mail, pour toutes les résidences du périmètre du compte.
- **Boîte de réception** : tous les messages, filtrables (des résidents, du syndic, échecs d'envoi) et cherchables (résident, lot, mot du message).
- **Onglet Nodo** : les messages lus par Nodo quand l'agence a activé « Nodo répond aux copropriétaires » : répondus par Nodo (non envoyés au syndic), transmis par Nodo au syndic, retransmis par le résident après la réponse de Nodo, analyse en cours ; avec le nombre de chacun et la part des messages auxquels Nodo a répondu.
- **Tri et urgence** (quand Nodo lit les messages) : catégorie (travaux et équipements, sinistre, charges et paiements, assemblée générale, nuisances et voisinage, administratif et documents, autre) et urgence (fuite, incendie, gaz, ascenseur, sécurité…). Un message urgent n'a jamais de réponse automatique : il part au syndic avec « [URGENT] » dans l'objet, porte une pastille rouge et reste en tête de la liste tant qu'il n'est pas ouvert. Filtre « Urgents » et menu « Catégorie ».
- **Non lus** : chaque nouveau message de résident est signalé (pastille du menu « Messages », compteur par résidence, message en gras) jusqu'à ce qu'un compte de l'agence l'ouvre.
- **Lecture** : le message, la réponse de Nodo et sa raison, puis tout l'échange avec ce résident pour ce lot, et un lien vers la fiche du résident.
- **Nouveau message** (compte agence et agents du service Syndic) : le syndic écrit le premier à un propriétaire (résidence, propriétaire et lot, objet, message) ; le message ouvre une conversation dans l'onglet « Mon syndic » de son application, il est notifié et peut y répondre. Copie à l'adresse du compte qui écrit (Cc), invisible pour le résident. Les locataires ne sont pas proposés : ils n'ont pas d'onglet « Mon syndic » dans l'application.
- Les actions **Nouveau message** et **Répondre** dépendent du réglage « Réponses dans l'application » de l'agence (section 9.2).
- **Répondre** (compte agence et agents du service Syndic) : la réponse s'affiche dans l'application du résident, qui reçoit une notification ; une copie part dans la boîte mail du syndic, rangée dans le fil du message du résident (le résident ne la voit pas). Si l'agence répond à cette copie depuis sa boîte mail, sa réponse revient aussi dans l'application. L'administrateur Konodal consulte sans répondre. Le résident est aussi notifié quand le syndic lui répond par mail.

---

## 12. Facturation (onglet Abonnement de la page Agence)

Réservée aux comptes **Agence** (un Agent n'y a pas accès). L'ancienne adresse `/facturation` y mène.

Affiche les lignes de l'abonnement (licence de chaque service souscrit, licences agent avec − / + : une licence libre peut être retirée, une licence ajoutée ; le changement et son montant sont confirmés avant l'envoi), l'estimation mensuelle, les factures (date, numéro, montant HT, statut, PDF), la période d'essai (jours restants) et le moyen de paiement. La carte bancaire est saisie dans la page, dans les champs sécurisés de Stripe : Konodal ne voit jamais le numéro ; une seule carte, remplaçable ou supprimable. Sans abonnement, l'agence choisit ses services et son stock de licences agent avant le paiement en ligne ; le portail de paiement Stripe reste accessible pour résilier ou modifier l'adresse de facturation.

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
Page envoyée par email lors de l'invitation du compte d'un service quand l'agence n'a pas encore d'abonnement. Affiche la gérance concernée, la licence service de l'invitation (imposée) et l'autre service s'il est activé, un sélecteur de licences agent, les deux prix et le total, puis redirige vers le paiement en ligne. Après paiement, un lien de définition de mot de passe est généré pour créer le compte.

---

## 15. Navigation

La barre latérale s'ouvre sur le Dashboard, puis regroupe les pages par thème, chacun annoncé par un petit titre :
- **Suivi** : Sinistres (Tableau Kanban, Liste des sinistres), Interventions (Calendrier, Liste des interventions) ;
- **Échanges** : Messages, Communication (Fil d'actualité et Chat Konodal pour le Super Admin) ;
- **Copropriétés** : Résidences (Actives, Demandes pour le Super Admin), Documents ;
- **Annuaire** : Utilisateurs (Annuaire, Demandes de retrait et Unificateur pour le Super Admin), Contacts, Agences (nommée Agence pour un compte agence, masquée pour les Agents) ;
- **Administration Konodal**, pour le Super Admin seulement : Contenus (Posts, Modération), Publicités, Base Nodo (Sources, Sites web autorisés, Propositions), Accès.

Les pages à plusieurs vues (Sinistres, Interventions, Communication, Résidences, Utilisateurs, Contenus, Base Nodo) gardent le même en-tête : titre à gauche, sélecteur de vue à droite et bouton d'action en dessous. Passer d'une vue à l'autre ne recharge pas la page : une vue déjà ouverte garde ses données et ses filtres.

Des pastilles signalent ce qui attend une décision : Annuaire (demandes de lot ou de certification), Demandes, Demandes de retrait, Unificateur, Modération, Propositions, Messages et Contacts. Une pastille bleue signale au Super Admin les réponses d'utilisateurs à lire. Une section fermée affiche la somme de ses sous-menus.

Le menu du compte, en bas de la barre latérale, donne accès au Profil, à la Facturation (onglet Abonnement de la page Agence, Agence uniquement) et à la déconnexion.

La plupart des tableaux se trient au clic sur l'en-tête : un clic dans le sens naturel de la colonne, un deuxième dans le sens inverse, un troisième revient à l'ordre par défaut. Les valeurs vides restent en fin de liste. Le tableau des lots d'une résidence garde son ordre manuel.

Quand une ligne n'a qu'une action (Gérer, Voir, Modifier, Ouvrir), un clic n'importe où sur la ligne la déclenche. Cela vaut pour les résidences, les utilisateurs, les agences, les communications, les interventions, les sinistres en cours, les demandes de résidence et leurs documents. Ctrl-clic (⌘-clic sur Mac) ou le clic molette ouvrent un nouvel onglet. Les liens, boutons et badges de la ligne gardent leur propre effet, et sélectionner du texte n'ouvre rien. Une ligne qui a plusieurs actions ne réagit qu'à ses boutons : contacts, publicités, votes, messages du Chat Konodal, factures, sites de Nodo, et sinistres terminés ou archivés (« Archiver » s'ajoute à « Voir »). C'est aussi le cas quand la seule action est une suppression : accès superAdmin, sources de Nodo.

---

## 16. Contenus (Super Admin)

### 16.1 Posts (`/contenus/posts`)
Toutes les publications de toutes les résidences, avec recherche (titre, texte, auteur), filtres par résidence et par type, et badge « Masqué ». Chaque publication s'ouvre avec ses commentaires et réponses, supprimables un par un. Une suppression exige un motif communiqué à l'auteur : le contenu est archivé puis retiré, et l'auteur notifié.

### 16.2 Modération (`/contenus/moderation`)
Publications, commentaires et réponses signalés depuis l'app. Indicateurs : À traiter, Ignorés, Supprimés. Dès 3 signalements de 3 personnes différentes, le contenu est masqué pour tous en attendant la décision. Les contenus masqués passent en tête, puis les plus signalés, puis les plus récents.

Actions : « Voir dans la publication », « Ignorer » ou « Rétablir » (le masquage est levé), « Supprimer » avec motif.

---

## 17. Nodo

### 17.1 Assistant
Assistant IA accessible par un bouton flottant sur toutes les pages, pour le Super Admin et les comptes Agence et Agent d'une gérance syndic. Les comptes de gérance locative n'y ont pas accès. Le panneau propose une nouvelle conversation, l'historique et des suggestions. Les conversations sont privées à leur auteur ; le backoffice n'a pas de vue d'administration des conversations.

Nodo peut préparer une action : communication à publier, intervention à programmer, mail à envoyer, intervention sur sinistre. Rien n'est exécuté sans « Confirmer », et les champs restent modifiables. Une intervention sur sinistre crée l'intervention, passe un sinistre « Transmis » en « En cours » et envoie l'ordre au prestataire.

### 17.2 Base de connaissances (`/nodo/connaissances`, Super Admin)
- **Sources** : colonnes source, domaine (Juridique, Fiscal, Métier, Financement, Technique, Patrimoine, Immobilier, Autre), statut, passages, date d'ajout. Ajout par fichier (PDF, Word, Excel, HTML, texte, Markdown, 15 Mo maximum, ou ZIP), lien, plusieurs liens (CSV) ou texte. Pour un ZIP, chaque fichier devient une source, son titre et son domaine étant lus dans l'en-tête Markdown ou déduits par Nodo.
- **Sites web autorisés** : ajout avec type (Presse / média, Officiel / collectivité) et test automatique ; mode de recherche, portée, origine, « Retester » et « Retirer ». Sans aucun site, la recherche web de Nodo est désactivée.
- **Propositions** : chaque lundi, les échanges marqués à revoir sont relus et donnent des fiches nouvelles ou des corrections, avec leur justification. Rien n'entre dans la base sans validation : « Modifier », « Rejeter », « Ajouter à la base » ou « Valider la correction », « Tout valider ».

---

## 18. Accès (`/acces`, Super Admin)

Liste des comptes Super Admin pouvant ouvrir n'importe quelle résidence dans l'app sans lot rattaché, pris en compte à leur prochaine connexion. Ajout par UID ou email, refusé si le compte est introuvable, déjà listé ou n'est pas Super Admin. Retrait avec confirmation.

---

## 19. Points notés comme non finalisés

- Le bloc « Respect des délais par niveau de priorité » du tableau de bord est affiché mais non actif : les seuils de délai par priorité ne sont pas encore configurables.
- La gestion des résidences n'est pleinement disponible que pour le périmètre des gérances de type « Syndic » ; le périmètre des gérances de type « Gérance locative » n'a pas encore de vue résidence dédiée dans le backoffice.
