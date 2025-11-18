/**
 * Script to update a single Reception document to add FODEC and TIMBRE fields
 * Usage: node scripts/update-single-reception.js <receptionId>
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

async function updateReception(receptionId) {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const reception = await Reception.findById(receptionId);
    
    if (!reception) {
      console.error(`Reception ${receptionId} not found`);
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log(`Found reception: ${reception.numero}`);

    const updates = {};
    let needsRecalculation = false;

    // Add missing fields with default values
    if (reception.fodecActif === undefined) {
      updates.fodecActif = false;
    }
    if (reception.tauxFodec === undefined) {
      updates.tauxFodec = 1;
    }
    if (reception.timbreActif === undefined) {
      updates.timbreActif = false;
    }
    if (reception.montantTimbre === undefined) {
      updates.montantTimbre = 1.000;
    }

    // Ensure totaux structure exists
    if (!reception.totaux) {
      reception.totaux = {};
      needsRecalculation = true;
    }
    
    if (reception.totaux.fodec === undefined) {
      updates['totaux.fodec'] = 0;
    }
    if (reception.totaux.timbre === undefined) {
      updates['totaux.timbre'] = 0;
    }
    if (reception.totaux.totalHT === undefined || reception.totaux.totalTVA === undefined || reception.totaux.totalTTC === undefined) {
      needsRecalculation = true;
    }

    // Recalculate totals if needed
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

      // Calculate FODEC if active
      const fodecActif = updates.fodecActif !== undefined ? updates.fodecActif : (reception.fodecActif || false);
      const tauxFodec = updates.tauxFodec !== undefined ? updates.tauxFodec : (reception.tauxFodec || 1);
      const fodec = fodecActif ? totalHT * (tauxFodec / 100) : 0;

      // Calculate TVA (base includes FODEC if active)
      reception.lignes.forEach((ligne) => {
        if (ligne.prixUnitaireHT && ligne.qteRecue > 0 && ligne.tvaPct) {
          const ligneHT = ligne.prixUnitaireHT * ligne.qteRecue;
          const ligneFodec = fodecActif ? ligneHT * (tauxFodec / 100) : 0;
          const ligneBaseTVA = ligneHT + ligneFodec;
          const ligneTVA = ligneBaseTVA * (ligne.tvaPct / 100);
          totalTVA += ligneTVA;
        }
      });

      // Calculate TIMBRE if active
      const timbreActif = updates.timbreActif !== undefined ? updates.timbreActif : (reception.timbreActif || false);
      const montantTimbre = updates.montantTimbre !== undefined ? updates.montantTimbre : (reception.montantTimbre || 1.000);
      const timbre = timbreActif ? montantTimbre : 0;

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
      console.log(`\nUpdated reception ${reception.numero}:`);
      console.log(JSON.stringify(updates, null, 2));
    } else {
      console.log('\nNo updates needed');
    }

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

const receptionId = process.argv[2];
if (!receptionId) {
  console.error('Usage: node scripts/update-single-reception.js <receptionId>');
  process.exit(1);
}

updateReception(receptionId);






