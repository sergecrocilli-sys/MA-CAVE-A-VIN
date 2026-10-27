# Vérification de Ma Cave V1.1 OneDrive

Date : 27 octobre 2026.
Base : ma_cave_V1(2).zip fourni par l'utilisateur.

## Contrôles effectués

- Lecture de l'archive, conservation de l'interface et des modules métier existants.
- Vérification de syntaxe de tous les JavaScript livrés.
- Contrôle des chemins de scripts, icônes, manifeste et fichiers du cache statique.
- Bibliothèque Microsoft MSAL Browser 4.30.0 intégrée localement, licence MIT incluse.
- Aucun secret client ; seul un ID client public est attendu dans config.js.
- Accès délégué Files.ReadWrite.AppFolder uniquement ; aucun élargissement automatique.
- Cache local séparé par ID d'application et ID de compte Microsoft.
- Limite de 100 références vérifiée à la validation et à la sauvegarde, pas une limite
  de 100 bouteilles.
- Le service worker ignore Graph, les adresses externes et les URL avec paramètres
  d'authentification. config.js est rafraîchi par le réseau si disponible pour permettre
  son activation après le premier déploiement.

## Tests automatisés simulés (réussis)

Exécution : node tests/sync.test.cjs (Node 20+).
Le faux OneDrive et les identifiants de test ne sont utilisés que dans ce script,
qui n'est pas chargé par index.html.

1. Création d'un vin sur un appareil, récupération sur un second.
2. Photos hors du JSON de révision ; hash, chargement et pagination simulés.
3. Retrait de stock et historique retrouvés sur l'autre appareil.
4. Formulaire périmé bloqué avant écriture distante.
5. Écriture hors connexion refusée ; 101 références refusées.
6. Réponse perdue après écriture : reprise sans doublon.
7. Deux écritures simultanées : les deux versions sont conservées, aucune n'est écrasée.
8. Résolution explicite des branches puis convergence des appareils.
9. Deux comptes utilisant le même cache de navigateur : caves séparées.
10. Deux onglets : un brouillon en attente n'est pas écrasé.

## Vérifications dans le navigateur

- Écran réel sans configuration : message explicite et guide d'activation accessibles.
- Avec une connexion et une sauvegarde SIMULÉES dans un dossier QA séparé :
  ouverture du formulaire et présence des deux contrôles photo ; ajout d'une référence
  de 12 bouteilles ; ouverture de sa fiche ; dégustation avec passage du stock à 11.
- Aucune page QA ni substitution d'authentification n'est incluse dans le ZIP livré.
- Le guide PDF de trois pages a été rendu et contrôlé visuellement.

## Non vérifié, à effectuer avant utilisation réelle

- Enregistrement de l'application dans le compte Microsoft du propriétaire.
- Consentement et authentification Microsoft réels sur Safari iPhone et navigateur PC.
- Accès réel au dossier AppFolder du OneDrive personnel ; certains comptes peuvent
  rencontrer un refus 403, à diagnostiquer sans ajouter de permission globale par défaut.
- Prise de photo sur un iPhone physique, conversion HEIC éventuelle et permissions iOS.
- Aller-retour réel d'une photo et d'un mouvement de stock entre iPhone et PC.
- Installation PWA et cache hors ligne sur l'adresse HTTPS GitHub Pages finale.
- Épuisement du quota ou limitations de débit sur un compte réel.

Le ZIP est une version de test privée prête à configurer, pas une certification
que la synchronisation fonctionne déjà avec un compte Microsoft non configuré.
Le guide CONFIGURATION_ONEDRIVE.md décrit le scénario d'activation et de recette.

## Limites assumées

Internet pour enregistrer, consultation du cache hors ligne. Actualisation au retour
au premier plan, environ chaque minute sans formulaire, et par bouton ; pas de temps
réel instantané. Conflits résolus par choix explicite de version, pas par fusion de stocks.
Historique et anciennes photos conservés sans purge automatique. 4 Mo maximum pour
une révision d'informations hors photos ; le cache et OneDrive ont aussi leurs quotas.
Une fiche par casier ; les références à stock zéro comptent dans les 100.
