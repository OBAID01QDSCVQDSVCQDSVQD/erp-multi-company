# Changelog

Toutes les modifications notables de ce projet seront documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Versioning Sémantique](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-10-27

### Ajouté
- Architecture de base avec Next.js 14 et TypeScript
- Intégration MongoDB avec Mongoose
- Système d'authentification avec NextAuth.js
- Interface utilisateur moderne avec Tailwind CSS
- Gestion multi-entreprises
- Modèles de données complets :
  - Entreprises
  - Utilisateurs avec rôles et permissions
  - Produits et services
  - Catégories de produits
  - Clients
  - Fournisseurs
  - Documents commerciaux (devis, factures, etc.)
- Pages de gestion :
  - Tableau de bord
  - Gestion des entreprises
  - Gestion des utilisateurs
  - Gestion des produits
  - Gestion des clients
  - Gestion des fournisseurs
  - Gestion des documents
  - Rapports et statistiques
  - Paramètres
- API REST complète
- Système de rapports avec graphiques
- Interface en français
- Documentation complète
- Scripts de configuration automatique
- Fichiers de démarrage pour Windows et Linux/Mac

### Fonctionnalités
- **Gestion des paramètres** : Configuration multi-entreprises, paramètres utilisateurs
- **Gestion des produits** : Catalogue complet avec catégories et stocks
- **Gestion des clients** : Base de données clients avec informations complètes
- **Gestion des fournisseurs** : Gestion des fournisseurs et conditions de paiement
- **Documents commerciaux** : Devis, bons de livraison, factures, avoirs
- **Gestion des règlements** : Suivi des paiements et échéanciers
- **Gestion de stock** : Bons d'entrée/sortie et inventaires
- **Conversions** : Workflow devis → bon de livraison → facture
- **Rapports** : Statistiques et analyses financières
- **Multi-utilisateurs** : Gestion des rôles et permissions

### Technique
- Next.js 14 avec App Router
- TypeScript pour la sécurité des types
- MongoDB pour la persistance des données
- NextAuth.js pour l'authentification
- Tailwind CSS pour le styling
- React Hook Form pour la gestion des formulaires
- Zod pour la validation des données
- Headless UI pour les composants accessibles

### Sécurité
- Authentification sécurisée
- Validation des données côté serveur
- Protection CSRF
- Permissions granulaires
- Chiffrement des mots de passe

## [0.1.0] - 2024-10-27

### Ajouté
- Initialisation du projet
- Configuration de base
- Structure des dossiers
