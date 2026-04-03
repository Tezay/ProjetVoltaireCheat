# Projet Voltaire Cheat (2026)

Fork du projet original de [MartinPELCAT](https://github.com/MartinPELCAT/ProjetVoltaireCheat), mis à jour et corrigé pour fonctionner avec les versions actuelles de Chrome.

Version courante: `2.2.0`

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
3. Dans la popup :
   - Cliquez sur **Détecter cette phrase** pour lancer une analyse manuelle.
   - Activez **Activer le raccourci clavier** pour pouvoir analyser la phrase sans rouvrir la popup ("**V**" par défaut).
   - Vous pouvez modifier la combinaison directement dans la popup.
4. Une carte de feedback apparaît en bas à gauche :
   - **Vert** : La phrase est correcte (selon Reverso).
   - **Rouge** : Une erreur est détectée, avec la correction proposée.
   - **Gris** : Une erreur technique est survenue.

## Raccourci clavier

- Le raccourci est **désactivé par défaut**.
- Une fois activé, il reste actif sur les pages `*.projet-voltaire.fr`.
- Il peut être configuré avec une touche seule ou une combinaison (`Ctrl`, `Alt`, `Shift`, `Cmd` + touche).
- Le raccourci est ignoré pendant la saisie dans les champs éditables.

## Build

Nécessite Node.js et Yarn.

```bash
yarn install
cd src/popup && yarn install && cd ../..
yarn build
```

Le build produit :

- `dist/` pour le chargement non empaqueté dans Chrome
- `extension.zip` pour une release

## Limitations et Fiabilité

L'extension utilise l'**API de Reverso**. Bien que ce soit la meilleure solution gratuite disponible, elle possède des limitations techniques inhérentes (environ **80% de fiabilité**).
Il est impossible de corriger ces points côté extension car ils dépendent directement du moteur de Reverso.

> ### Points de vigilance
> - **Conjugaison** : Subjonctif présent (2ème personne du singulier) : Ajoute un *s* même sur les formes se terminant par un *e* muet (ex: *Saches* au lieu de *Sache*).
> - **Confusions fréquentes** : *Plus tôt/Plutôt*, *Affaire/À faire*, *Leur/Leurs*.
> - **Sémantique** : De façon générale sur les mots nécessitant une analyse sémantique globale du contexte.
>
> **Gardez un œil critique sur les suggestions !**

## Licence

Apache 2.0 — Voir le fichier [LICENSE](LICENSE).
