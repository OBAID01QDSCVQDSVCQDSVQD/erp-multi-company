# Politique de Sécurité

## Versions Supportées

Nous fournissons des mises à jour de sécurité pour les versions suivantes :

| Version | Supporté          |
| ------- | ----------------- |
| 1.0.x   | :white_check_mark: |

## Signaler une Vulnérabilité

Nous prenons la sécurité de l'ERP Multi-Entreprises très au sérieux. Si vous découvrez une vulnérabilité de sécurité, veuillez nous en informer de manière responsable.

### Comment Signaler

**NE PAS** créer d'issue publique pour les vulnérabilités de sécurité.

Au lieu de cela, veuillez :

1. **Envoyer un email** à l'équipe de sécurité à : security@example.com
2. **Inclure** les informations suivantes :
   - Description détaillée de la vulnérabilité
   - Étapes pour reproduire le problème
   - Impact potentiel
   - Suggestions de correction (si vous en avez)

### Processus de Traitement

1. **Accusé de réception** : Nous confirmerons la réception de votre rapport dans les 48 heures
2. **Évaluation** : Nous évaluerons la vulnérabilité et son impact
3. **Correction** : Nous développerons et testerons un correctif
4. **Publication** : Nous publierons une mise à jour de sécurité
5. **Reconnaissance** : Nous reconnaîtrons votre contribution (si vous le souhaitez)

### Délais de Réponse

- **Accusé de réception** : 48 heures
- **Évaluation initiale** : 7 jours
- **Correction** : 30 jours (selon la criticité)
- **Publication** : 7 jours après la correction

## Bonnes Pratiques de Sécurité

### Pour les Développeurs

- Utilisez toujours des requêtes paramétrées
- Validez toutes les entrées utilisateur
- Implémentez l'authentification et l'autorisation appropriées
- Chiffrez les données sensibles
- Maintenez les dépendances à jour
- Suivez le principe du moindre privilège

### Pour les Utilisateurs

- Utilisez des mots de passe forts et uniques
- Activez l'authentification à deux facteurs si disponible
- Maintenez votre système à jour
- Sauvegardez régulièrement vos données
- Surveillez les logs d'accès
- Formez vos utilisateurs aux bonnes pratiques

## Mesures de Sécurité Implémentées

### Authentification
- Hachage sécurisé des mots de passe avec bcrypt
- Sessions JWT avec expiration
- Protection contre les attaques par force brute

### Autorisation
- Système de rôles et permissions granulaires
- Vérification des permissions côté serveur
- Isolation des données par entreprise

### Validation des Données
- Validation côté client et serveur
- Sanitisation des entrées utilisateur
- Protection contre les injections

### Chiffrement
- Chiffrement des données sensibles
- Communication HTTPS
- Stockage sécurisé des clés

### Monitoring
- Logs d'audit
- Détection des tentatives d'intrusion
- Alertes de sécurité

## Mises à Jour de Sécurité

Les mises à jour de sécurité sont publiées :
- Immédiatement pour les vulnérabilités critiques
- Dans les 30 jours pour les vulnérabilités importantes
- Dans les 90 jours pour les vulnérabilités mineures

## Contact

Pour toute question relative à la sécurité :
- Email : security@example.com
- Issue privée : [Créer une issue privée](../../issues/new?template=security.md)

## Reconnaissance

Nous remercions tous ceux qui nous aident à maintenir la sécurité de ce projet en signalant des vulnérabilités de manière responsable.
