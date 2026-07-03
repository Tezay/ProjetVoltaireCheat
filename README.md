# Projet Voltaire Cheat

Extension Chrome qui résout automatiquement les exercices **Projet Voltaire** et **Académie Voltaire** à votre place.

https://github.com/user-attachments/assets/a0194dad-b85a-4535-a2aa-179321bc205f

---

## Fonctionnement

L'extension lit chaque exercice et clique sur la bonne réponse pour vous. Elle fonctionne de deux façons selon la situation :

- **Lecture directe** : Elle lit la réponse directement dans le code de la page Projet Voltaire. C'est la méthode la plus fiable : la réponse est certaine.
- **Suggestion Reverso** : Quand la lecture directe n'est pas possible, elle envoie la phrase à l'API Reverso (correcteur d'orthographe) pour obtenir une suggestion. C'est une bonne approximation, mais pas infaillible.

Elle gère tous les types d'exercices :

| Type d'exercice | Méthode utilisée |
|---|---|
| Phrase avec ou sans faute | Lecture directe, puis Reverso si nécessaire |
| Mot à trouver | Lecture directe uniquement |
| Classement (glisser-déposer) | Lecture directe uniquement |
| Dictée audio avec mot(s) à écrire | Lecture directe uniquement |
| Session d'évaluation | Reverso quand la lecture directe est indisponible |
| Écrans de transition (Suivant, Continuer…) | Passage automatique |

Si aucune méthode ne fonctionne sur une question, l'extension s'arrête plutôt que de répondre au hasard.

---

## Installation

L'extension n'est pas disponible sur le Chrome Web Store. Elle s'installe manuellement en quelques étapes.

1. **Télécharger** : Récupérez `extension.zip` depuis la page [Releases](../../releases) de ce dépôt et extrayez-le. Vous obtiendrez un dossier `dist`.
2. **Ouvrir les extensions Chrome** : Dans Chrome, allez sur `chrome://extensions/` et activez le **Mode développeur** (en haut à droite).
3. **Charger l'extension** : Cliquez sur **Charger l'extension non empaquetée** et sélectionnez le dossier `dist`.
4. **Épingler l'icône** *(recommandé)* : Cliquez sur l'icône puzzle en haut à droite de Chrome et épinglez **Projet Voltaire Cheat**.

---

## Mise à jour

Quand une nouvelle version est disponible :

1. Téléchargez le nouveau `extension.zip`.
2. Remplacez l'ancien dossier `dist` par le nouveau (extrait depuis le ZIP).
3. Allez sur `chrome://extensions/` et cliquez sur **Recharger** (l'icône ↺ sous l'extension).
4. Rechargez l'onglet Projet Voltaire si il était déjà ouvert.

---

## Utilisation

1. Ouvrez un exercice sur [Projet Voltaire](https://www.projet-voltaire.fr) ou Académie Voltaire.
2. Cliquez sur l'icône de l'extension dans la barre Chrome.
3. Choisissez votre mode.

### Mode automatique

Activez le **Mode automatique** dans la popup. L'extension résout alors les questions en continu, passe les écrans de transition, et enchaîne jusqu'à la fin de la session. Vous n'avez rien d'autre à faire.

### Résoudre une question à la demande

Cliquez sur le bouton **Corriger cette question** pour résoudre uniquement la question affichée à ce moment. Utile si vous voulez garder la main et n'utiliser l'extension que ponctuellement.

### Raccourci clavier

Un raccourci clavier permet de déclencher la correction d'une question sans ouvrir la popup. Par défaut la touche est **V** (désactivé par défaut, à activer dans les réglages avancés). Il peut être modifié ou réinitialisé depuis la popup.

### Raccourci discret

Un second raccourci, indépendant du précédent, résout la question en cours sans afficher aucune carte de retour à l'écran. Par défaut la touche est **B** (désactivé par défaut). Ponctuel uniquement : il n'existe pas de version automatique de ce mode.

---

## Ce qu'affiche la popup

La popup vous indique en temps réel ce que fait l'extension :

- **La source utilisée** : *Lecture directe* (réponse certaine) ou *Reverso* (suggestion approximative). Un indicateur coloré vous montre laquelle est active : vert pour la lecture directe, bleu pour Reverso.
- **La phrase en cours** : Le texte de l'exercice que l'extension est en train de lire.
- **La dernière action** : Ce que l'extension vient de faire.
- **Le raccourci** : Son état et sa touche.
- **Les statistiques de session** : Nombre de réponses directes, Reverso, transitions automatiques, pauses et erreurs de test.

---

## Réglages avancés

Cliquez sur **Réglages avancés** dans la popup pour accéder aux options suivantes.

### Utiliser seulement Reverso

Désactive la lecture directe et force l'utilisation de Reverso pour toutes les phrases. Utile uniquement pour tester ou diagnostiquer un problème. **Non recommandé en utilisation normale.**

### Délai automatique

En mode automatique, l'extension attend entre chaque action pour paraître naturelle. Vous pouvez ajuster le délai minimum et maximum (en secondes). Par défaut : entre 1 et 2 secondes.

### Taux d'erreur directe

Permet de simuler volontairement des erreurs sur les réponses directes, pour rendre la session moins suspecte. S'applique uniquement en mode automatique, sur les réponses certaines (pas sur Reverso). Réglé à 0 % par défaut (aucune erreur simulée).

### Raccourci clavier

Depuis ce panneau vous pouvez :
- **Activer ou désactiver** le raccourci.
- **Modifier** la touche (cliquez sur Modifier puis appuyez sur la combinaison souhaitée).
- **Réinitialiser** sur la touche V par défaut.

Le **raccourci discret** se règle de la même façon, juste en dessous, et se réinitialise sur la touche B.

---

## Limitations

- **Lecture directe dépendante de Projet Voltaire** : Si Projet Voltaire modifie en profondeur son application, la lecture directe peut cesser de fonctionner. L'extension bascule alors sur Reverso, ou se met en pause.
- **Dictées audio en lecture directe uniquement** : Les exercices de dictée audio sont résolus seulement si la réponse exacte est présente dans l'état React/Fiber de la page. Aucun fallback Reverso n'est utilisé pour ce type d'exercice.
- **Reverso n'est pas parfait** : L'API Reverso peut se tromper, notamment sur les phrases avec des noms propres, du vocabulaire rare, ou des tournures complexes. C'est pourquoi l'extension ne l'utilise que comme solution de repli.
- **Fonctionne uniquement sur Chrome** : L'extension est au format Manifest V3 Chrome. Elle n'est pas compatible Firefox ou Safari sans adaptation.

---

## Pour les développeurs

### Prérequis

- Node.js
- Yarn

### Installation des dépendances

```bash
yarn install
cd src/popup && yarn install && cd ../..
```

### Validation (lint + typecheck + tests)

```bash
yarn validate
```

### Build

```bash
yarn build
```

Produit `dist/` et `extension.zip`.

### Hook pre-commit

```bash
yarn hooks:install
```

Lance `yarn validate` automatiquement avant chaque commit.

---

## Licence

Apache 2.0 - voir le fichier [LICENSE](LICENSE).

Basé sur le projet original de [MartinPELCAT](https://github.com/MartinPELCAT/ProjetVoltaireCheat).
