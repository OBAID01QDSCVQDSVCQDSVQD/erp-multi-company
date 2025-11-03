# ERP Multi-Entreprises

Une solution complète de gestion d'entreprise (ERP) multi-entreprises développée avec Next.js et MongoDB.

## Fonctionnalités

### Gestion des paramètres de l'application
- Configuration multi-entreprises
- Paramètres utilisateurs et permissions
- Configuration des devises et formats

### Gestion des familles de produits et de services
- Catégories hiérarchiques
- Codes et descriptions
- Gestion par entreprise

### Gestion des produits et services
- Catalogue complet
- Gestion des prix et TVA
- Suivi des stocks
- Codes produits uniques

### Gestion des fournisseurs
- Informations complètes
- Conditions de paiement
- Coordonnées bancaires
- Historique des commandes

### Gestion des clients
- Base de données clients
- Adresses de facturation
- Informations fiscales
- Historique des ventes

### Documents commerciaux
- Devis
- Bons de livraison
- Factures
- Notes d'honoraires
- Avoirs

### Gestion des règlements
- Suivi des paiements
- Échéanciers
- Relances automatiques
- Journal de vente

### Gestion de stock
- Bons d'entrée et de sortie
- Inventaires
- Alertes de stock
- Valorisation

### Conversions
- Devis → Bon de livraison
- Bon de livraison → Facture
- Workflow automatisé

### Statistiques et rapports
- Tableaux de bord
- Rapports de vente
- Analyses financières
- Export des données

### Multi-utilisateurs
- Gestion des rôles
- Permissions granulaires
- Audit trail
- Sécurité avancée

## Technologies utilisées

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, MongoDB, Mongoose
- **Authentification**: NextAuth.js
- **UI**: Headless UI, Heroicons
- **Validation**: Zod, React Hook Form

## Installation

1. Clonez le repository
```bash
git clone <repository-url>
cd erp-multi-company
```

2. Installez les dépendances
```bash
npm install
```

3. Configurez les variables d'environnement
Créez un fichier `.env.local` :
```env
MONGODB_URI=mongodb://localhost:27017/erp-multi-company
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here
NEXT_PUBLIC_APP_NAME=ERP Multi-Entreprises
NEXT_PUBLIC_APP_VERSION=1.0.0
```

4. Démarrez MongoDB
Assurez-vous que MongoDB est en cours d'exécution sur votre machine.

5. Lancez l'application
```bash
npm run dev
```

L'application sera accessible sur [http://localhost:3000](http://localhost:3000)

## Structure du projet

```
src/
├── app/                    # Pages Next.js
│   ├── api/               # API Routes
│   ├── auth/              # Pages d'authentification
│   └── dashboard/         # Pages du tableau de bord
├── components/            # Composants React
│   └── Layout/           # Composants de mise en page
├── lib/                  # Utilitaires et configuration
│   ├── models/           # Modèles Mongoose
│   ├── auth.ts           # Configuration NextAuth
│   ├── config.ts         # Configuration de l'app
│   └── mongodb.ts        # Connexion MongoDB
└── types/                # Types TypeScript
```

## Utilisation

1. **Première connexion** : Créez un compte administrateur
2. **Configuration** : Configurez votre première entreprise
3. **Utilisateurs** : Ajoutez des utilisateurs avec les permissions appropriées
4. **Données** : Commencez par ajouter vos produits, clients et fournisseurs
5. **Facturation** : Créez vos premiers devis et factures

## Développement

### Ajout de nouvelles fonctionnalités
1. Créez le modèle Mongoose dans `src/lib/models/`
2. Ajoutez les API routes dans `src/app/api/`
3. Créez les composants UI dans `src/components/`
4. Ajoutez les pages dans `src/app/`

### Base de données
Le projet utilise MongoDB avec Mongoose pour la modélisation des données. Chaque entreprise a ses propres données isolées.

### Sécurité
- Authentification avec NextAuth.js
- Validation des données avec Zod
- Protection CSRF intégrée
- Permissions granulaires par utilisateur

## Contribution

1. Forkez le projet
2. Créez une branche pour votre fonctionnalité
3. Committez vos changements
4. Poussez vers la branche
5. Ouvrez une Pull Request

## Licence

Ce projet est sous licence MIT. Voir le fichier LICENSE pour plus de détails.
