/**
 * Script to activate FODEC and TIMBRE for all existing Reception documents
 * Usage: node scripts/activate-fodec-timbre-all-receptions.js
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const ReceptionSchema = new mongoose.Schema({
  societeId: String,
  numero: String,
  dateDoc: Date,
  purchaseOrderId: String,
  fournisseurId: String,
  fournisseurNom: String,
  statut: String,
  lignes: [{
    productId: String,
    reference: String,
    designation: String,
    uom: String,
    qteCommandee: Number,
    qteRecue: Number,
    prixUnitaireHT: Number,
    tvaPct: Number,
    totalLigneHT: Number,
  }],
  totaux: {
    totalHT: Number,
    fodec: Number,
    totalTVA: Number,
    timbre: Number,
    totalTTC: Number,
  },
  fodecActif: Boolean,
  tauxFodec: Number,
  timbreActif: Boolean,
  montantTimbre: Number,
  notes: String,
  createdBy: String,
}, { timestamps: true, strict: false });

const Reception = mongoose.models.Reception || mongoose.model('Reception', ReceptionSchema);

async function activateFodecTimbre() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find all receptions
    const receptions = await Reception.find({});

    console.log(`Found ${receptions.length} receptions to update`);

    let updated = 0;
    for (const reception of receptions) {
      const updates = {};
      let needsRecalculation = false;

      // Activate FODEC and TIMBRE
      if (!reception.fodecActif) {
        updates.fodecActif = true;
        needsRecalculation = true;
      }
      if (!reception.timbreActif) {
        updates.timbreActif = true;
        needsRecalculation = true;
      }

      // Ensure values are set
      if (reception.tauxFodec === undefined || reception.tauxFodec === null) {
        updates.tauxFodec = 1;
      }
      if (reception.montantTimbre === undefined || reception.montantTimbre === null) {
        updates.montantTimbre = 1.000;
      }

      // Recalculate totals if FODEC or TIMBRE was activated
      if (needsRecalculation && reception.lignes && reception.lignes.length > 0) {
        let totalHT = 0;
        let totalTVA = 0;

        // Calculate TotalHT
        reception.lignes.forEach((ligne) => {
          if (ligne.prixUnitaireHT && ligne.qteRecue > 0) {
            const ligneHT = ligne.prixUnitaireHT * ligne.qteRecue;
            totalHT += ligneHT;
          }
        });

        // Calculate FODEC (now active)
        const tauxFodec = updates.tauxFodec !== undefined ? updates.tauxFodec : (reception.tauxFodec || 1);
        const fodec = totalHT * (tauxFodec / 100);

        // Calculate TVA (base includes FODEC)
        reception.lignes.forEach((ligne) => {
          if (ligne.prixUnitaireHT && ligne.qteRecue > 0 && ligne.tvaPct) {
            const ligneHT = ligne.prixUnitaireHT * ligne.qteRecue;
            const ligneFodec = ligneHT * (tauxFodec / 100);
            const ligneBaseTVA = ligneHT + ligneFodec;
            const ligneTVA = ligneBaseTVA * (ligne.tvaPct / 100);
            totalTVA += ligneTVA;
          }
        });

        // Calculate TIMBRE (now active)
        const montantTimbre = updates.montantTimbre !== undefined ? updates.montantTimbre : (reception.montantTimbre || 1.000);
        const timbre = montantTimbre;

        // Calculate TotalTTC
        const totalTTC = totalHT + fodec + totalTVA + timbre;

        updates['totaux.totalHT'] = totalHT;
        updates['totaux.fodec'] = fodec;
        updates['totaux.totalTVA'] = totalTVA;
        updates['totaux.timbre'] = timbre;
        updates['totaux.totalTTC'] = totalTTC;
      }

      if (Object.keys(updates).length > 0) {
        await Reception.updateOne(
          { _id: reception._id },
          { $set: updates }
        );
        updated++;
        console.log(`✅ Updated reception ${reception.numero} (${reception._id})`);
      }
    }

    console.log(`\n🎉 Migration completed: ${updated} receptions updated`);
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Migration error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

activateFodecTimbre();


