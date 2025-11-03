# Guide de Contribution

Merci de votre intérêt pour contribuer à l'ERP Multi-Entreprises ! Ce document fournit des directives pour contribuer au projet.

## Comment Contribuer

### Signaler un Bug

1. Vérifiez que le bug n'a pas déjà été signalé dans les [Issues](../../issues)
2. Créez une nouvelle issue avec le label "bug"
3. Incluez :
   - Description détaillée du problème
   - Étapes pour reproduire le bug
   - Comportement attendu vs comportement actuel
   - Captures d'écran si applicable
   - Informations sur votre environnement (OS, navigateur, version Node.js)

### Proposer une Amélioration

1. Vérifiez que l'amélioration n'a pas déjà été proposée
2. Créez une nouvelle issue avec le label "enhancement"
3. Décrivez clairement l'amélioration proposée
4. Expliquez pourquoi elle serait utile

### Contribuer au Code

1. **Fork** le repository
2. **Clone** votre fork localement :
   ```bash
   git clone https://github.com/votre-username/erp-multi-company.git
   cd erp-multi-company
   ```

3. **Créez une branche** pour votre fonctionnalité :
   ```bash
   git checkout -b feature/nom-de-votre-fonctionnalite
   ```

4. **Installez les dépendances** :
   ```bash
   npm install --legacy-peer-deps
   ```

5. **Configurez l'environnement** :
   ```bash
   npm run setup
   ```

6. **Faites vos modifications** en suivant les conventions de code

7. **Testez vos modifications** :
   ```bash
   npm run lint
   npm run type-check
   npm run build
   ```

8. **Commitez vos changements** :
   ```bash
   git add .
   git commit -m "feat: ajouter nouvelle fonctionnalité"
   ```

9. **Poussez vers votre fork** :
   ```bash
   git push origin feature/nom-de-votre-fonctionnalite
   ```

10. **Créez une Pull Request** vers la branche `main`

## Conventions de Code

### TypeScript/JavaScript

- Utilisez TypeScript pour tous les nouveaux fichiers
- Suivez les conventions ESLint configurées
- Utilisez des noms de variables et fonctions descriptifs
- Ajoutez des commentaires pour le code complexe

### React

- Utilisez des composants fonctionnels avec hooks
- Préférez `const` et `let` à `var`
- Utilisez des props typées avec TypeScript
- Suivez les conventions de nommage des composants (PascalCase)

### CSS/Styling

- Utilisez Tailwind CSS pour le styling
- Créez des classes utilitaires dans `globals.css` si nécessaire
- Suivez la convention mobile-first

### Base de Données

- Utilisez Mongoose pour les modèles
- Ajoutez des index appropriés
- Validez les données côté serveur
- Utilisez des transactions pour les opérations critiques

## Structure des Commits

Utilisez le format [Conventional Commits](https://www.conventionalcommits.org/) :

```
type(scope): description

[body optionnel]

[footer optionnel]
```

Types disponibles :
- `feat`: nouvelle fonctionnalité
- `fix`: correction de bug
- `docs`: documentation
- `style`: formatage, point-virgules manquants, etc.
- `refactor`: refactoring du code
- `test`: ajout ou modification de tests
- `chore`: tâches de maintenance

Exemples :
```
feat(auth): ajouter authentification à deux facteurs
fix(invoice): corriger calcul de la TVA
docs(readme): mettre à jour instructions d'installation
```

## Processus de Review

1. **Assignation** : Un mainteneur sera assigné à votre PR
2. **Review** : Le code sera examiné pour :
   - Qualité du code
   - Respect des conventions
   - Tests appropriés
   - Documentation mise à jour
3. **Feedback** : Des commentaires seront fournis si des modifications sont nécessaires
4. **Approval** : Une fois approuvé, la PR sera mergée

## Questions ?

Si vous avez des questions, n'hésitez pas à :
- Ouvrir une issue avec le label "question"
- Contacter les mainteneurs
- Rejoindre les discussions dans les issues

## Reconnaissance

Tous les contributeurs seront mentionnés dans le fichier CONTRIBUTORS.md.

Merci de contribuer à l'amélioration de l'ERP Multi-Entreprises ! 🚀
