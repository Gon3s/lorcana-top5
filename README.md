# Lorcana Top 5

Mini-site français statique pour classer cinq cartes par encre et par extension. Le set 14 est sélectionné par défaut. Les bicolores sont éligibles dans leurs deux tops, indépendamment. Les variantes, promotions et illustrations numérotées hors série sont exclues de cette V1.

## Fonctionnalités

- Grille des cartes avec URLs officielles, recherche par nom et sélecteur de set.
- Six tops ordonnés, modification du rang et suppression, limite de cinq cartes sans doublon par encre.
- Sauvegarde des classements par set dans le navigateur.
- Page récapitulative et lien de partage autonome : titre, set et identifiants sont encodés dans le fragment URL. Aucun compte ni serveur nécessaire.
- Les liens ouvrent une vue de consultation. « Créer ma version » enregistre une copie locale.
- Export PNG des six tops et impression / PDF. Le workflow copie les miniatures officielles sur le site pour éviter les restrictions CORS pendant l’export. La grille conserve les URLs officielles. Si une image n’a pas pu être copiée et que le serveur distant refuse CORS, le PNG conserve le nom et le rang et signale le visuel manquant.
- Import manuel du JSON officiel, conservé dans IndexedDB. Un catalogue importé localement reste sur cet appareil ; les destinataires ont besoin d’un catalogue contenant le même set.

## Catalogue officiel

Source : https://api.lorcana.ravensburger.com/v3/catalog/fr

L’import reprend les conventions utilisées par `Gon3s/lorcana-coconut-proxies-fr` : catégories dans `cards`, identifiants `culture_invariant_id`, noms FR et image `variants[variant_id=Regular].detail_image_url`. Les encres viennent de `magic_ink_colors`. Le numéro de carte et le set sont lus dans `card_identifier`, par exemple `1/204 • FR • 14`.

```bash
python scripts/fetch_catalog.py
node scripts/build.mjs --catalog .cache/catalog-fr.json --require-catalog
python scripts/mirror_images.py
```

L’API peut refuser les requêtes sans authentification. Le téléchargement accepte un jeton utilisateur via `LORCANA_BEARER_TOKEN`, ou une valeur d’authentification Basic autorisée via `LORCANA_BASIC_AUTH`, utilisée côté workflow pour demander un jeton à `https://sso.ravensburger.de/token`. Aucune clé d’application n’est embarquée dans le code ou le site. N’ajoutez jamais ces valeurs dans les fichiers versionnés.

Pour importer sans accès direct à l’API, télécharger le JSON depuis un environnement ayant accès puis :

```bash
python scripts/fetch_catalog.py --input /chemin/catalog-fr.json
node scripts/build.mjs --catalog .cache/catalog-fr.json --require-catalog
```

Pour fournir un catalogue durable aux workflows, ajouter le JSON officiel à `data/catalog-source.json` dans le dépôt (prioritaire sur l’API). Un nouveau set présent dans ce fichier ou dans une récupération API sera automatiquement proposé dans le sélecteur, sans changement de code.

`web/data/catalog.json` est un catalogue normalisé vide au départ : aucune fausse carte n’est affichée. Sans catalogue réel, le site local offre l’import manuel, mais le workflow de publication échoue volontairement pour éviter de publier une collection vide. Les tests utilisent uniquement des fixtures synthétiques, exclues de `dist`.

## Développement et vérification

Aucune dépendance npm. Node.js 24 et Python 3.12 suffisent.

```bash
npm test
npm run build
npm start
```

Ouvrir http://localhost:8080. Pour servir le résultat de build : `python -m http.server 8080 --directory dist`.

Pour vérifier les exports avec les images locales, exécuter `python scripts/mirror_images.py` après le build, puis servir `dist`. Les miniatures sont réutilisées depuis `.cache/export-images` lors des mises à jour.

## GitHub Pages

1. Créer le dépôt public `Gon3s/lorcana-top5`, avec `main` comme branche par défaut, puis pousser ces fichiers.
2. Dans **Settings → Pages → Build and deployment**, sélectionner **GitHub Actions**.
3. Fournir `data/catalog-source.json`, ou configurer une authentification autorisée dans **Settings → Secrets and variables → Actions** si nécessaire.
4. Le workflow `.github/workflows/pages.yml` teste, récupère et valide le catalogue, construit `dist`, puis déploie Pages sur chaque push de `main`, lancement manuel et actualisation quotidienne à 05:20 UTC. Les pull requests exécutent la validation et produisent un aperçu en artifact, sans déploiement.

Le cache conserve le dernier téléchargement réussi. Une panne de l’API utilise ce cache ou le catalogue versionné ; sans source valide, la publication s’arrête. Un échec de build ne remplace pas le site déjà publié. Aucun commit automatique n’est nécessaire pour actualiser le catalogue.

URL attendue après activation et déploiement réussi : https://Gon3s.github.io/lorcana-top5/

Projet de fans non officiel. Disney Lorcana © Disney / Ravensburger. Les cartes et leurs illustrations restent la propriété de leurs ayants droit.
