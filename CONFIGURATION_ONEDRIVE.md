# Ma Cave V1.1 - Configuration et premier test privé

## Ce qui est livré et ce qui reste à activer

Le code inclut la connexion Microsoft, l'accès au dossier d'application OneDrive,
les photos, la synchronisation et la détection des versions concurrentes.
L'identifiant Microsoft réel n'est PAS fourni : il doit être créé dans ton compte.
La connexion réelle et les échanges iPhone/PC restent à tester après activation.
Ne considère pas ce ZIP comme une synchronisation déjà validée avec ton compte.

## 1. Publier sur GitHub Pages

- Crée le dépôt qui servira à Ma Cave, puis active GitHub Pages.
- Dépose le CONTENU du dossier MA_CAVE_V1 à la racine publiée : index.html,
  config.js, app.js, style.css, vendor/, js/, assets/ et les autres fichiers.
- Aucun npm, compilation, serveur privé ou clé secrète n'est nécessaire au déploiement.
- Conserve .nojekyll. Ne dépose jamais tes sauvegardes JSON ni tes photos dans GitHub.
- Note l'adresse HTTPS exacte. Exemple fictif :
  https://ton-compte.github.io/ma-cave/
- La page de retour Microsoft sera alors exactement :
  https://ton-compte.github.io/ma-cave/index.html
  Respecte majuscules, chemin du dépôt et extension. Remplace l'exemple par TON adresse.

## 2. Enregistrer l'application Microsoft (une seule fois, pour le créateur)

Les utilisateurs de Ma Cave auront seulement besoin d'un compte Microsoft personnel
avec un OneDrive activé et de l'espace libre. Pour enregistrer l'application, son
créateur doit disposer d'un accès Microsoft Entra permettant les inscriptions
d'applications. Le compte gratuit OneDrive d'un utilisateur ne garantit pas cet
accès administrateur. Si le portail refuse de créer l'inscription, arrête-toi à ce
point et fais vérifier l'accès au tenant ; n'achète pas de service au hasard.

1. Ouvre https://entra.microsoft.com/ avec le compte destiné à maintenir l'application.
2. Microsoft Entra ID > Inscriptions d'applications > Nouvelle inscription.
3. Nom : Ma Cave Privee. Conserve ensuite cette inscription : son nom détermine
   le dossier de l'application dans OneDrive.
4. Types de comptes : **Comptes Microsoft personnels uniquement**. Le code utilise
   l'autorité consumers. Les comptes professionnels seuls ne sont pas la cible de ce test.
5. Ajoute une plateforme **Application monopage / Single-page application (SPA)**,
   PAS Web ni application mobile/native.
6. URI de redirection : l'adresse exacte .../index.html notée à l'étape 1.
7. Ne coche pas les flux implicites ID tokens / Access tokens ; la bibliothèque
   utilise le code d'autorisation avec PKCE.
8. Ne crée AUCUN secret client, certificat ou mot de passe d'application.
9. Autorisations API > Microsoft Graph > Autorisations déléguées :
   **Files.ReadWrite.AppFolder**. Cette application ne demande pas Files.ReadWrite
   ni Files.ReadWrite.All. User.Read n'est pas utilisé par le code.
10. Copie l'**ID d'application (client)**, de forme UUID.

Un consentement au dossier de Ma Cave est demandé à chaque utilisateur lors de
sa première connexion. Ses identifiants sont saisis exclusivement chez Microsoft.
L'application ne reçoit pas son mot de passe.

## 3. Renseigner config.js

Remplace uniquement la chaîne vide clientId par l'ID obtenu, par exemple :

    clientId: 'IDENTIFIANT-REEL-DE-TON-INSCRIPTION',

L'ID client est public et peut rester dans GitHub. Ce n'est pas un secret.
L'adresse de retour est calculée vers index.html dans le même dossier.
Ne modifie pas l'autorité et ne colle aucun jeton dans le code.
Publie ce fichier et attends que GitHub Pages ait terminé son déploiement.
Le bandeau doit cesser d'indiquer « Configuration Microsoft à terminer ».

## 4. Premier test PC, puis iPhone

1. Sauvegarde d'abord l'ancienne cave par JSON si elle contient déjà des données.
2. Sur PC, ouvre l'adresse HTTPS, clique Connecter mon OneDrive, choisis ton
   compte Microsoft PERSONNEL et autorise le dossier de Ma Cave.
3. Si le compte n'a jamais utilisé OneDrive, ouvre une fois https://onedrive.live.com/
   pour terminer son activation, puis reviens à Ma Cave.
4. Après connexion, attends le bandeau « À jour sur OneDrive ».
5. Crée un emplacement de test et un vin de test avec une quantité de 3.
6. Sur iPhone, ouvre la MÊME adresse dans Safari et connecte le MÊME compte.
7. La référence et son stock de 3 doivent apparaître. Sinon, utilise Actualiser.
8. Ouvre sa fiche > Modifier > Prendre une photo avec le téléphone. Prends une
   étiquette, vérifie l'aperçu, puis Enregistrer. Attends la confirmation OneDrive.
9. Sur PC, clique Actualiser : la photo doit apparaître sur la même fiche.
10. Saisis une dégustation avec retrait d'une bouteille. Sur iPhone, actualise :
    stock attendu 2, et dégustation présente.
11. Ferme puis rouvre l'application sur les deux appareils : stock 2 et photo conservés.
12. Exporte un JSON depuis Ma Cave. Il doit inclure la photo (data:image/jpeg),
    pas seulement une référence de fichier. Conserve cette sauvegarde ailleurs.
13. iPhone en mode avion : les données déjà chargées sont consultables ; un
    enregistrement doit être refusé et le formulaire doit rester ouvert.
14. Rétablis Internet, ferme le formulaire, puis Actualiser avant de poursuivre.
15. Installe ensuite depuis Safari > Partager > Sur l'écran d'accueil. La version
    installée peut demander une nouvelle connexion au même compte Microsoft.

Le bouton photo utilise le sélecteur système avec capture=environment. Selon la
version iOS, il ouvre directement l'appareil photo ou propose un choix système.
Le second bouton permet de choisir une image existante. Les photos HEIC ne sont
acceptées que si le navigateur sait les décoder ; un JPEG reste le choix le plus sûr.

## 5. Données et protection contre les conflits

- 100 références maximum, y compris les références à stock zéro. Une référence peut
  représenter 6, 12 ou 100 bouteilles. Une même référence répartie en deux casiers
  nécessite actuellement deux fiches ; cela consomme deux références.
- Chaque compte Microsoft possède son dossier Apps/Ma Cave Privee (ou le nom réel
  choisi chez Microsoft), distinct des dossiers des autres comptes.
- Les photos sont compressées en JPEG, 1200 pixels maximum, objectif inférieur
  à environ 600 Ko. L'original n'est pas envoyé.
- Les photos sont séparées des fiches et réutilisées tant que leur contenu ne change pas.
- Chaque sauvegarde crée une version complète des informations SANS réenvoyer les
  photos inchangées. L'historique consomme donc progressivement de l'espace.
- L'application n'efface pas automatiquement l'historique ni les anciennes photos.
  Ne supprime pas manuellement les fichiers mc-r- : les liens de parenté sont nécessaires.
- L'application actualise au retour au premier plan et environ chaque minute,
  tant qu'aucun formulaire n'est ouvert. Actualiser permet une vérification immédiate.
  Ce n'est pas une diffusion instantanée en temps réel.
- Une modification distante détectée avant sauvegarde bloque l'enregistrement :
  ferme le formulaire, actualise et ressaisis ta modification.
- Deux sauvegardes réellement simultanées peuvent créer deux versions. Le bandeau
  propose de les comparer/exporter, puis de choisir explicitement une base commune.
  Il n'y a pas de fusion automatique des stocks ; les versions non retenues restent conservées.
- Après une coupure réseau ambiguë, un brouillon est conservé dans le cache de ce
  compte. « Vérifier / réessayer » recherche la version déjà envoyée avant de réémettre.
  Ne répète pas une sortie de stock tant que le bandeau demande cette vérification.
- Si le brouillon ne peut plus être appliqué à la version distante, exporte-le,
  abandonne-le, actualise, puis ressaisis les différences utiles.
- Les fichiers mc-r- sont des formats internes sans photo intégrée. Pour un export
  portable, utilise toujours Exporter ma cave dans l'application.

## 6. Chaque ami reste indépendant

Envoie l'adresse GitHub Pages, pas ton compte Microsoft ni tes sauvegardes.
Ton ami choisit son compte personnel sur téléphone et PC. Son OneDrive reçoit sa
propre cave. Il n'a pas à enregistrer lui-même une application Microsoft.
Le code publié n'interdit pas à une autre personne possédant l'adresse de créer
sa propre cave dans SON OneDrive : ce n'est pas une liste d'invitations limitée à quatre.
Cela ne lui donne pas accès à tes données.

## 7. Erreurs courantes

- AADSTS50011 / redirect URI : vérifie l'URI .../index.html et la plateforme SPA.
- Compte refusé : utilise un compte Microsoft personnel et l'autorité consumers.
- 403 sur le dossier d'application : vérifie Files.ReadWrite.AppFolder et le
  consentement. Des incompatibilités ont été signalées pour certains comptes
  personnels. Le code n'élargit jamais les permissions automatiquement. Si cela
  persiste, le test est bloqué à ce niveau et doit être diagnostiqué.
- Connexion expirée : bouton Reconnecter ; pas de mot de passe à saisir dans Ma Cave.
- Espace plein : libère de l'espace dans OneDrive, puis Vérifier / réessayer.
- Bouton d'installation absent sur iPhone : utilise Safari et le menu Partager.
- Photo refusée : choisis un JPEG ou reprends-la depuis le bouton de capture.
- Ancienne version de l'interface : ferme TOUS les onglets et la PWA, puis rouvre.
  Une mise à jour du service worker attend la fermeture des anciennes pages.

## 8. Confidentialité et sauvegardes

Le code est hébergé sur GitHub ; les données personnelles ne le sont pas.
Les données et photos sont transmises à Microsoft pour être stockées dans le
OneDrive du compte connecté. Elles ne sont pas chiffrées de bout en bout par Ma Cave.
Un cache isolé par identifiant de compte est conservé dans le navigateur, et les
informations de session sont gérées par MSAL. La déconnexion masque la cave sans
supprimer ce cache. Sur un appareil partagé, utilise une session système séparée
ou efface ensuite les données du site (en ayant vérifié la sauvegarde OneDrive).
Une suppression de fichiers dans OneDrive peut affecter la cave. Fais des exports
JSON réguliers sur un autre support. Le créateur de l'application n'obtient aucun
accès global aux OneDrive des autres utilisateurs : le flux est délégué au compte connecté.

## Références officielles utilisées pour l'intégration

- Dossier d'application et permission restreinte :
  https://learn.microsoft.com/en-us/graph/onedrive-sharepoint-appfolder
- Enregistrement Microsoft :
  https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app
- Téléchargement JavaScript et URL temporaire :
  https://learn.microsoft.com/en-us/graph/api/driveitem-get-content
- Bibliothèque Microsoft locale : @azure/msal-browser 4.30.0, licence MIT incluse.
