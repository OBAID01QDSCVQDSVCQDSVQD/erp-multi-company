# Plan de la page Dépenses Utilisateur (User Expenses & Advances Page)

## 📋 Vue d'ensemble
Page personnelle pour chaque utilisateur affichant:
- **Les dépenses** créées par l'utilisateur
- **Les avances** données aux employés (via les salaires)

---

## 🎯 المتطلبات

### 1. البيانات المطلوبة

#### أ. المصاريف (Expenses)
- ✅ المصروفات التي أنشأها المستخدم (`createdBy`)
- ✅ الحالة الحالية: `brouillon`, `en_attente`, `valide`, `paye`, `rejete`
- ⚠️ **مطلوب إضافة**: 
  - `approvedBy`: من قام بالموافقة/التحقق
  - `approvedAt`: وقت الموافقة
  - `paidBy`: من قام بالدفع/الإقفال
  - `paidAt`: وقت الدفع/الإقفال

#### ب. التسبقات (Advances)
- ✅ التسبقات من `Salary.deductions.advancesList`
- ✅ `createdBy`: من أنشأ التسبقة
- ✅ `date`: تاريخ التسبقة
- ✅ `amount`: المبلغ
- ⚠️ **مطلوب إضافة**:
  - `repaidBy`: من قام بسداد التسبقة (إذا تم السداد)
  - `repaidAt`: وقت السداد
  - `isRepaid`: حالة السداد (تم/لم يتم)

---

## 📐 تصميم الصفحة

### Route
```
/profile/expenses
```

### المكونات الرئيسية

#### 1. Header Section
```
┌─────────────────────────────────────────────────┐
│ ← [Nom Utilisateur] - Mes Dépenses et Avances  │
│    [Filtre par mois: Janvier 2024 ▼]           │
└─────────────────────────────────────────────────┘
```

#### 2. Statistics Cards
```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Total        │  │ Dépenses     │  │ Avances      │  │ Dépenses     │
│ Dépenses     │  │ Complétées   │  │ Complétées   │  │ En Attente   │
│ 50,000 TND   │  │ 30,000 TND   │  │ 10,000 TND   │  │ 20,000 TND   │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

#### 3. Tabs Section
```
┌─────────────────────────────────────────────────┐
│ [Dépenses] [Avances] [Tout]                      │
└─────────────────────────────────────────────────┘
```

#### 4. Expenses Table (Tableau des Dépenses)
```
┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│ Date     │ Numéro   │ Catégorie│ Montant  │ Statut   │ Payé     │ Payé par │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ 15/01    │ EXP-2024 │ 🚗 Trans │ 500 TND  │ ✅ Payé  │ 20/01    │ Ahmed    │
│          │ -00001   │          │          │          │ 14:30    │ Mohamed  │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ 10/01    │ EXP-2024 │ 🍽️ Repas │ 200 TND  │ ⏳ En    │ -        │ -        │
│          │ -00002   │          │          │ attente  │          │          │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
```

#### 5. Advances Table (Tableau des Avances)
```
┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│ Date     │ Employé  │ Montant  │ Notes    │ Statut   │ Remboursé│ Remboursé│
│          │          │          │          │          │          │ par      │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ 05/01    │ Mohamed  │ 500 TND  │ -        │ ✅ Oui   │ 10/01    │ Sarah    │
│          │ Ali      │          │          │          │ 10:00    │ Ahmed    │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ 12/01    │ Khaled   │ 300 TND  │ Urgent   │ ⏳ Non   │ -        │ -        │
│          │ Hassan   │          │          │          │          │          │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
```

---

## 🔧 Modifications Requises sur les Modèles

### 1. Mise à jour du Modèle Expense
```typescript
// Ajouter de nouveaux champs dans ExpenseSchema
approvedBy?: mongoose.Types.ObjectId;  // Qui a approuvé
approvedAt?: Date;                      // Date d'approbation
paidBy?: mongoose.Types.ObjectId;       // Qui a payé/clôturé
paidAt?: Date;                          // Date de paiement/clôture
```

### 2. Mise à jour du Schema Advance (dans Salary)
```typescript
// Ajouter de nouveaux champs dans AdvanceSchema
repaidBy?: string;      // Qui a remboursé l'avance
repaidAt?: Date;        // Date de remboursement
isRepaid?: boolean;     // Statut de remboursement
```

---

## 📡 API Endpoints Requis

### 1. GET /api/profile/expenses
```typescript
// Query Parameters:
// - month: number (1-12)
// - year: number
// - type: 'expenses' | 'advances' | 'all'

// Response:
{
  expenses: Expense[],
  advances: Advance[],
  statistics: {
    totalExpenses: number,
    completedExpenses: number,
    completedAdvances: number,
    pendingExpenses: number
  }
}
```

---

## 🎨 Interface (Composants UI)

### 1. Composant Filtre
- Dropdown pour le mois: Janvier, Février, ... Décembre
- Dropdown pour l'année: 2024, 2023, ...
- Bouton "Afficher tout"

### 2. Composant Badge de Statut
- ✅ Payé (paye): Vert
- ⏳ En attente (en_attente): Jaune
- ✅ Validé (valide): Bleu
- ❌ Rejeté (rejete): Rouge
- 📝 Brouillon (brouillon): Gris

### 3. Composant Tableau
- Design responsive (mobile/desktop)
- Tri (optionnel)
- Pagination (si beaucoup de données)

---

## 📝 Cas d'Utilisation

### 1. Afficher les Dépenses de l'Utilisateur
- L'utilisateur ouvre sa page personnelle
- Voit toutes ses dépenses avec leur statut
- Peut filtrer par mois

### 2. Suivre les Avances
- L'utilisateur voit les avances qu'il a données
- Sait si elles ont été remboursées ou non
- Voit qui les a remboursées et quand

### 3. Statistiques
- Total des dépenses
- Nombre de dépenses complétées
- Nombre d'avances remboursées

---

## 🔄 Workflow

### Lors du Changement de Statut d'une Dépense:
1. L'utilisateur change le statut de "en attente" à "payé"
2. Le système enregistre:
   - `paidBy`: L'utilisateur actuel
   - `paidAt`: L'heure actuelle
3. La page affiche la mise à jour immédiatement

### Lors du Remboursement d'une Avance:
1. L'utilisateur rembourse une avance du salaire d'un employé
2. Le système enregistre:
   - `repaidBy`: L'utilisateur actuel
   - `repaidAt`: L'heure actuelle
   - `isRepaid`: true
3. La page affiche la mise à jour

---

## 📱 Responsive Design

### Desktop View
- جدول كامل مع جميع الأعمدة
- إحصائيات في صف واحد

### Mobile View
- Cards بدلاً من الجدول
- إحصائيات في عمود واحد
- Swipe للتنقل بين التبويبات

---

## ✅ Checklist d'Implémentation

### Phase 1: Mise à jour des Modèles
- [ ] Ajouter `approvedBy`, `approvedAt` à Expense
- [ ] Ajouter `paidBy`, `paidAt` à Expense
- [ ] Ajouter `repaidBy`, `repaidAt`, `isRepaid` à Advance

### Phase 2: API
- [ ] Créer l'endpoint `/api/profile/expenses`
- [ ] Mettre à jour `/api/expenses/[id]` pour sauvegarder `paidBy`, `paidAt`
- [ ] Mettre à jour `/api/hr/salaries/[id]/advances` pour sauvegarder `repaidBy`, `repaidAt`

### Phase 3: Interface
- [ ] Créer la page `/profile/expenses`
- [ ] Composant Filtre
- [ ] Cartes de Statistiques
- [ ] Tableau des Dépenses
- [ ] Tableau des Avances
- [ ] Navigation par Onglets

### Phase 4: Tests
- [ ] Tester le filtrage par mois
- [ ] Tester l'affichage des statuts
- [ ] Tester le design responsive

---

## 🎯 Notes Supplémentaires

1. **Sécurité**: S'assurer que l'utilisateur ne voit que ses propres dépenses et avances
2. **Performance**: Utiliser la pagination si beaucoup de données
3. **Dates**: Utiliser le timezone local
4. **Traduction**: Support français (et arabe si nécessaire)

---

## 📊 Exemple de Données

```json
{
  "expenses": [
    {
      "_id": "...",
      "numero": "EXP-2024-00001",
      "date": "2024-01-15",
      "categorieId": { "nom": "Transport", "icone": "🚗" },
      "totalTTC": 500,
      "statut": "paye",
      "paidBy": { "firstName": "Ahmed", "lastName": "Mohamed" },
      "paidAt": "2024-01-20T14:30:00Z"
    }
  ],
  "advances": [
    {
      "date": "2024-01-05",
      "amount": 500,
      "employeeName": "Mohamed Ali",
      "isRepaid": true,
      "repaidBy": "Sarah Ahmed",
      "repaidAt": "2024-01-10T10:00:00Z"
    }
  ]
}
```
