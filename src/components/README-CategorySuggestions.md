# 🎯 Système de suggestions de catégories de dépenses

## Vue d'ensemble

Le système de suggestions intelligentes permet aux utilisateurs de créer rapidement des catégories de dépenses en utilisant des suggestions prédéfinies basées sur les catégories standard françaises.

## Fonctionnalités

### ✨ **Suggestions intelligentes**

#### **19 catégories prédéfinies**
- **Transport & Déplacements** (🚗) - Frais de taxi, carburant, péages...
- **Repas & Restauration** (🍽️) - Repas professionnels, collations...
- **Hébergement & Séjours** (🏨) - Hôtels, locations temporaires...
- **Fournitures de bureau** (🖇️) - Papier, stylos, imprimantes...
- **Matériel consommé** (🧰) - Petits matériaux utilisés...
- **Entretien & Nettoyage** (🧼) - Produits d'entretien, maintenance...
- **Téléphone & Internet** (📞) - Abonnements, téléphones...
- **Électricité & Eau** (💡) - Factures d'électricité, gaz...
- **Loyer & Charges locatives** (🏢) - Loyer, assurance, taxes...
- **Salaires & Charges sociales** (👷) - Rémunérations, cotisations...
- **Formation & Séminaires** (🎓) - Formations, conférences...
- **Marketing & Publicité** (📣) - Flyers, réseaux sociaux...
- **Frais bancaires** (💳) - Commissions, virements...
- **Assurances** (🛡️) - Assurance responsabilité, véhicules...
- **Informatique & Logiciels** (💻) - Licences, hébergements...
- **Matériel durable / Investissement** (🏗️) - Machines, outils...
- **Honoraires & Prestations externes** (🧾) - Comptable, avocat...
- **Dépenses exceptionnelles** (⚠️) - Amendes, dons, pertes...
- **Autres dépenses** (📁) - Toute autre dépense...

### 🔍 **Recherche intelligente**

#### **Filtrage multi-critères**
- Recherche par **nom** de catégorie
- Recherche par **code** de catégorie
- Recherche par **description** de catégorie
- Recherche insensible à la casse

#### **Suggestions en temps réel**
- Affichage automatique lors de la saisie
- Maximum 5 suggestions dans le dropdown
- Mise à jour dynamique selon la recherche

### 🎨 **Interface utilisateur**

#### **Dropdown de suggestions**
- Affichage compact avec icône, nom, code et description
- Hover effects et transitions fluides
- Fermeture automatique lors de la sélection

#### **Panneau de suggestions complet**
- Vue d'ensemble de toutes les catégories
- Grille responsive (1-3 colonnes selon la taille d'écran)
- Badges pour le code et le type global
- Descriptions tronquées avec tooltip

#### **Fonctionnalités avancées**
- **Suggestion aléatoire** : Bouton pour une catégorie aléatoire
- **Auto-remplissage** : Remplissage automatique de tous les champs
- **Fermeture intelligente** : Clic en dehors pour fermer
- **Validation** : Intégration avec react-hook-form

## Utilisation

### 1. **Dans la modale de création**

```tsx
<ExpenseCategoryModal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  onSuccess={handleSuccess}
  tenantId={tenantId}
/>
```

### 2. **Saisie intelligente**

1. **Tapez dans le champ "Nom"** :
   - `transport` → Suggestions liées au transport
   - `restaurant` → Suggestions liées à la restauration
   - `informatique` → Suggestions liées à l'informatique

2. **Cliquez sur "Voir les suggestions"** :
   - Affiche toutes les catégories disponibles
   - Filtrage en temps réel
   - Sélection en un clic

3. **Utilisez la suggestion aléatoire** :
   - Bouton "🎲 Suggestion aléatoire"
   - Génère une catégorie aléatoire
   - Parfait pour les tests

### 3. **Auto-remplissage**

Lors de la sélection d'une suggestion :
- ✅ **Nom** : Rempli automatiquement
- ✅ **Code** : Généré automatiquement
- ✅ **Description** : Remplie automatiquement
- ✅ **Icône** : Sélectionnée automatiquement
- ✅ **Type global** : Défini automatiquement

## Configuration

### **Ajouter de nouvelles suggestions**

```typescript
const categorySuggestions = [
  {
    code: 'DEP_NOUVEAU',
    nom: 'Nouvelle catégorie',
    description: 'Description de la nouvelle catégorie',
    icone: '🆕',
    typeGlobal: 'exploitation'
  },
  // ... autres suggestions
];
```

### **Personnaliser l'affichage**

```tsx
// Nombre de suggestions dans le dropdown
{filteredSuggestions.slice(0, 5).map(...)}

// Hauteur maximale du panneau
<div className="max-h-48 overflow-y-auto">
```

## Démonstration

### **Page de démonstration**
- URL : `/demo-categories`
- Interface complète pour tester les suggestions
- Recherche en temps réel
- Sélection et affichage des résultats

### **Fonctionnalités de test**
- ✅ Recherche par nom, code, description
- ✅ Filtrage en temps réel
- ✅ Sélection et affichage des détails
- ✅ Statistiques de recherche
- ✅ Interface responsive

## Intégration

### **Avec react-hook-form**
```typescript
const { register, setValue, watch } = useForm<CategoryForm>({
  resolver: zodResolver(categorySchema),
});

// Auto-remplissage
const applySuggestion = (suggestion) => {
  setValue('nom', suggestion.nom);
  setValue('code', suggestion.code);
  setValue('description', suggestion.description);
  setValue('icone', suggestion.icone);
  setValue('typeGlobal', suggestion.typeGlobal);
};
```

### **Avec Zod validation**
```typescript
const categorySchema = z.object({
  nom: z.string().min(1, 'Le nom est requis'),
  code: z.string().min(1, 'Le code est requis'),
  // ... autres champs
});
```

## Avantages

### **🚀 Productivité**
- Création rapide de catégories
- Réduction des erreurs de saisie
- Standardisation des noms et codes

### **🎯 UX optimisée**
- Interface intuitive
- Feedback visuel clair
- Recherche intelligente

### **🔧 Maintenabilité**
- Suggestions centralisées
- Facile à étendre
- Code réutilisable

### **📊 Qualité des données**
- Noms standardisés
- Codes cohérents
- Descriptions complètes

## Exemples d'utilisation

### **Recherche par mot-clé**
```
"transport" → Transport & Déplacements, Matériel durable...
"restaurant" → Repas & Restauration
"informatique" → Informatique & Logiciels
"formation" → Formation & Séminaires
```

### **Recherche par code**
```
"DEP_TRANSPORT" → Transport & Déplacements
"DEP_BANQUE" → Frais bancaires
"DEP_INVEST" → Matériel durable / Investissement
```

### **Recherche par description**
```
"hôtel" → Hébergement & Séjours
"papier" → Fournitures de bureau
"salaires" → Salaires & Charges sociales
```

Le système de suggestions transforme la création de catégories en une expérience fluide et intuitive ! 🎉









