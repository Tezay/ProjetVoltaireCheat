# Projet Voltaire Cheat (2026)

Fork du projet original de [MartinPELCAT](https://github.com/MartinPELCAT/ProjetVoltaireCheat), mis à jour et corrigé pour fonctionner avec les versions actuelles de Chrome.

## Installation

1. Téléchargez le fichier `extension.zip` depuis les Releases (ou clonez le repo et lancez `yarn build`).
2. Dézippez le contenu.
3. Ouvrez Chrome et allez sur `chrome://extensions/`.
4. Activez le **Mode développeur** (en haut à droite).
5. Cliquez sur **Charger l'extension non empaquetée** et sélectionnez le dossier `dist`.
6. Epinglez l'extension.

## Utilisation

1. Allez sur le site Projet Voltaire et commencez un exercice.
2. Cliquez sur l'icône de l'extension.
3. Une carte de feedback apparaît en bas à gauche :
   - **Vert** : La phrase est correcte (selon Reverso).
   - **Rouge** : Une erreur est détectée, avec la correction proposée.

## Build

Nécessite Node.js et Yarn.

```bash
yarn install
cd src/popup && yarn install && cd ../..
yarn build
```

## Licence

Apache 2.0 — Voir le fichier [LICENSE](LICENSE).
