# Module ExpenseCategories - NestJS + Mongoose

## Vue d'ensemble

Le module ExpenseCategories fournit une API complète pour la gestion des catégories de dépenses dans un environnement multi-tenant. Il inclut la validation, la sécurité, les tests et un système de seeding automatique.

## Structure du module

```
src/lib/
├── models/
│   └── ExpenseCategoryNestJS.ts          # Schéma Mongoose avec validation
├── dto/
│   └── expense-category.dto.ts           # DTOs avec class-validator
├── services/
│   ├── expense-category.service.ts       # Logique métier
│   └── company.service.ts                # Service Company modifié
├── controllers/
│   └── expense-category.controller.ts    # Controller REST
├── guards/
│   ├── tenant.guard.ts                   # Guard multi-tenant
│   ├── jwt-auth.guard.ts                 # Guard JWT
│   └── roles.guard.ts                    # Guard RBAC
├── decorators/
│   └── roles.decorator.ts                # Décorateur pour les rôles
├── modules/
│   └── expense-category.module.ts        # Module NestJS
├── scripts/
│   └── seed-expense-categories.ts        # Script CLI de seeding
└── tests/
    ├── expense-category.service.spec.ts  # Tests unitaires
    └── expense-category.e2e-spec.ts      # Tests e2e
```

## Fonctionnalités

### 1. Schéma Mongoose

- **Champs** : tenantId, code, nom, description, icone, typeGlobal, isActive
- **Types** : typeGlobal enum (exploitation, consommable, investissement, financier, exceptionnel)
- **Indexes** :
  - `{ tenantId: 1, code: 1 }` unique (unicité par tenant)
  - `{ tenantId: 1, nom: 1 }` pour la recherche
  - `{ tenantId: 1, typeGlobal: 1 }` pour le filtrage

### 2. Validation DTO

- **CreateExpenseCategoryDto** : Validation complète avec class-validator
- **UpdateExpenseCategoryDto** : Champs optionnels pour la mise à jour
- **ExpenseCategoryQueryDto** : Filtres et pagination

### 3. API REST sécurisée

- **GET** `/expense-categories` : Liste paginée/filtrable
- **POST** `/expense-categories` : Création avec validation d'unicité
- **PATCH** `/expense-categories/:id` : Mise à jour
- **DELETE** `/expense-categories/:id` : Suppression avec vérification d'usage

### 4. Sécurité

- **Multi-tenant** : Isolation par tenantId
- **JWT Authentication** : Authentification requise
- **RBAC** : Permissions `expenses.categories.view` et `expenses.categories.edit`
- **Validation** : Données validées côté serveur

### 5. Seeding automatique

- **16 catégories par défaut** en français
- **Seeding automatique** lors de la création d'une société
- **Script CLI** : `pnpm api:seed-expense-categories --tenant=tenantId`

## Utilisation

### 1. Intégration dans l'application

```typescript
// app.module.ts
import { ExpenseCategoryModule } from './lib/modules/expense-category.module';

@Module({
  imports: [
    // ... autres modules
    ExpenseCategoryModule,
  ],
})
export class AppModule {}
```

### 2. Utilisation du service

```typescript
import { ExpenseCategoryService } from './lib/services/expense-category.service';

@Injectable()
export class SomeService {
  constructor(
    private expenseCategoryService: ExpenseCategoryService,
  ) {}

  async createCategory(tenantId: string, data: CreateExpenseCategoryDto) {
    return this.expenseCategoryService.create(tenantId, data);
  }
}
```

### 3. Seeding manuel

```bash
# Seeding pour un tenant spécifique
pnpm api:seed-expense-categories --tenant=demo-tenant-123

# Le seeding se fait automatiquement lors de la création d'une société
```

## Tests

### Tests unitaires

```bash
npm run test src/lib/tests/expense-category.service.spec.ts
```

### Tests e2e

```bash
npm run test:e2e src/lib/tests/expense-category.e2e-spec.ts
```

## Frontend (Next.js)

### 1. Modale de création/édition

Le composant `ExpenseCategoryModal` fournit :
- Validation côté client avec Zod
- Auto-génération du code à partir du nom
- Gestion des erreurs
- Interface utilisateur moderne

### 2. Intégration dans les formulaires

- Option "Créer une catégorie" dans les selects
- Ouverture automatique de la modale
- Pré-sélection de la nouvelle catégorie

### 3. Page de gestion

- Liste des catégories avec recherche
- Actions de modification/suppression
- Gestion des conflits (catégorie utilisée)

## Catégories par défaut

| Code | Nom | Type | Icône |
|------|-----|------|-------|
| DEP_TRANSPORT | Transport & Déplacements | exploitation | 🚗 |
| DEP_RESTAURATION | Repas & Restauration | exploitation | 🍽️ |
| DEP_HEBERGEMENT | Hébergement & Séjours | exploitation | 🏨 |
| DEP_FOURNITURE | Fournitures de bureau | exploitation | 🖇️ |
| DEP_MATERIEL_CONSOM | Matériel consommé | consommable | 🧰 |
| DEP_ENTRETIEN | Entretien & Nettoyage | exploitation | 🧼 |
| DEP_COMMUNICATION | Téléphone & Internet | exploitation | 📞 |
| DEP_ENERGIE | Électricité & Eau | exploitation | 💡 |
| DEP_LOCATION | Loyer & Charges locatives | exploitation | 🏢 |
| DEP_BANQUE | Frais bancaires | financier | 💳 |
| DEP_INFORMATIQUE | Informatique & Logiciels | exploitation | 💻 |
| DEP_ASSURANCE | Assurances | exploitation | 🛡️ |
| DEP_CONSULTANT | Honoraires & Prestations externes | exploitation | 🧾 |
| DEP_INVEST | Matériel durable / Investissement | investissement | 🏗️ |
| DEP_EXCEP | Dépenses exceptionnelles | exceptionnel | ⚠️ |
| DEP_DIVERS | Autres dépenses | exploitation | 📁 |

## Sécurité et bonnes pratiques

1. **Validation** : Toujours valider les données côté serveur
2. **Multi-tenant** : Vérifier le tenantId dans toutes les opérations
3. **Permissions** : Utiliser les guards RBAC appropriés
4. **Tests** : Maintenir une couverture de tests élevée
5. **Logging** : Logger les opérations importantes
6. **Gestion d'erreurs** : Retourner des messages d'erreur clairs

## Dépendances

- `@nestjs/common`
- `@nestjs/mongoose`
- `@nestjs/swagger`
- `class-validator`
- `class-transformer`
- `mongoose`
- `zod` (frontend)
- `react-hook-form` (frontend)








