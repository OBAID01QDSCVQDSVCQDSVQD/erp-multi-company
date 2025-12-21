import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import PaiementFournisseur from '@/lib/models/PaiementFournisseur';
import PurchaseInvoice from '@/lib/models/PurchaseInvoice';
import Supplier from '@/lib/models/Supplier';
import { NumberingService } from '@/lib/services/NumberingService';
import mongoose from 'mongoose';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();

    const tenantId = session.user.companyId?.toString() || '';
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const fournisseurId = searchParams.get('fournisseurId') || '';

    const query: any = { societeId: new mongoose.Types.ObjectId(tenantId) };

    if (search) {
      query.$or = [
        { numero: { $regex: search, $options: 'i' } },
        { fournisseurNom: { $regex: search, $options: 'i' } },
        { reference: { $regex: search, $options: 'i' } },
      ];
    }

    if (fournisseurId) {
      query.fournisseurId = new mongoose.Types.ObjectId(fournisseurId);
    }

    const total = await PaiementFournisseur.countDocuments(query);
    const paiements = await PaiementFournisseur.find(query)
      .sort({ datePaiement: -1, numero: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Enrich payment lines with referenceFournisseur from invoices if missing
    const enrichedPaiements = await Promise.all(
      paiements.map(async (paiement: any) => {
        const enriched: any = {
          ...paiement,
          images: paiement.images || [], // Ensure images array is always present
        };

        if (paiement.lignes && paiement.lignes.length > 0) {
          const enrichedLignes = await Promise.all(
            paiement.lignes.map(async (ligne: any) => {
              // If referenceFournisseur is missing, fetch it from the invoice
              if (!ligne.referenceFournisseur && ligne.factureId) {
                const invoice = await (PurchaseInvoice as any).findOne({
                  _id: ligne.factureId,
                  societeId: new mongoose.Types.ObjectId(tenantId),
                }).select('referenceFournisseur').lean();

                if (invoice && invoice.referenceFournisseur) {
                  ligne.referenceFournisseur = invoice.referenceFournisseur;
                }
              }
              return ligne;
            })
          );
          enriched.lignes = enrichedLignes;
        }
        return enriched;
      })
    );

    return NextResponse.json({
      items: enrichedPaiements,
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error('Erreur GET /api/purchases/payments:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();

    const tenantId = session.user.companyId?.toString() || '';
    const body = await request.json();

    // Helper function to extract numeric part from payment number
    const extractNumericPart = (numero: string): { number: number; prefix: string; padding: number } | null => {
      if (!numero) return null;
      const numericMatch = numero.match(/(\d+)$/);
      if (!numericMatch) return null;

      const number = parseInt(numericMatch[1], 10);
      const prefix = numero.substring(0, numero.length - numericMatch[1].length);
      const padding = numericMatch[1].length;

      return { number, prefix, padding };
    };

    // Helper function to generate next payment number
    const generateNextPaymentNumber = async (): Promise<string> => {
      try {
        // Find all payments for this tenant, sorted by numero descending to get the highest first
        const allPayments = await (PaiementFournisseur as any).find({
          societeId: new mongoose.Types.ObjectId(tenantId)
        })
          .select('numero')
          .sort({ numero: -1 }) // Sort descending to get highest number first
          .limit(500) // Increased limit for better accuracy
          .lean();

        let maxNumber = 0;
        let maxNumeroFormat = '';
        let maxPrefix = '';
        let maxPadding = 5; // Default padding

        // Find the payment with the highest numeric value
        for (const payment of allPayments) {
          if (payment.numero) {
            const extracted = extractNumericPart(payment.numero);
            if (extracted && extracted.number > maxNumber) {
              maxNumber = extracted.number;
              maxNumeroFormat = payment.numero;
              maxPrefix = extracted.prefix;
              maxPadding = extracted.padding;
            }
          }
        }

        if (maxNumeroFormat && maxNumber > 0) {
          const nextNumber = maxNumber + 1;
          const newNumero = maxPrefix + nextNumber.toString().padStart(maxPadding, '0');
          console.log(`Generated payment number: ${newNumero} (from max: ${maxNumeroFormat}, next: ${nextNumber})`);
          return newNumero;
        }

        // No payments found, use NumberingService to generate first number
        const fallbackNumero = await NumberingService.next(tenantId, 'pafo');
        console.log(`Using NumberingService for first payment: ${fallbackNumero}`);
        return fallbackNumero;
      } catch (error) {
        console.error('Error generating payment number:', error);
        // Fallback to NumberingService on error
        try {
          return await NumberingService.next(tenantId, 'pafo');
        } catch (nsError) {
          // If NumberingService also fails, generate a simple number
          const year = new Date().getFullYear();
          return `PAFO-${year}-00001`;
        }
      }
    };

    // Helper function to increment payment number
    const incrementPaymentNumber = (currentNumero: string): string => {
      const extracted = extractNumericPart(currentNumero);
      if (extracted) {
        const nextNumber = extracted.number + 1;
        return extracted.prefix + nextNumber.toString().padStart(extracted.padding, '0');
      }
      // If we can't parse, return empty string to trigger regeneration
      return '';
    };

    // Helper to escape regex special characters
    const escapeRegExp = (string: string) => {
      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };

    // Get supplier name if not provided
    let fournisseurNom = body.fournisseurNom || '';
    if (body.fournisseurId && !fournisseurNom) {
      const supplier = await (Supplier as any).findOne({ _id: body.fournisseurId, tenantId: tenantId });
      if (supplier) {
        fournisseurNom = supplier.raisonSociale || `${supplier.nom || ''} ${supplier.prenom || ''}`.trim();
      }
    }

    // Check if using advance balance
    const useAdvanceBalance = body.useAdvanceBalance === true;
    const advanceAmount = parseFloat(body.advanceAmount) || 0;
    const currentAdvanceBalance = parseFloat(body.currentAdvanceBalance) || 0; // Current available advance balance

    // Validate and process payment lines
    const lignes = [];
    const factureIds = [];
    let isPaymentOnAccount = false;

    // Check if this is a payment on account (no invoices, just amount)
    if (body.isPaymentOnAccount && body.montantOnAccount) {
      const montantOnAccount = parseFloat(body.montantOnAccount) || 0;
      if (montantOnAccount <= 0) {
        return NextResponse.json(
          { error: 'Le montant du paiement sur compte doit être supérieur à zéro' },
          { status: 400 }
        );
      }

      isPaymentOnAccount = true;
      // For payment on account, create a line without factureId
      // Create object without factureId and numeroFacture (they will be undefined)
      const paymentOnAccountLine: any = {
        referenceFournisseur: '',
        montantFacture: 0,
        montantPayeAvant: 0,
        montantPaye: montantOnAccount,
        soldeRestant: 0,
        isPaymentOnAccount: true,
      };
      // Only add numeroFacture for display purposes, but not factureId
      paymentOnAccountLine.numeroFacture = 'PAIEMENT SUR COMPTE';
      lignes.push(paymentOnAccountLine);
    } else {
      // Regular payment with invoices
      for (const line of body.lignes || []) {
        if (!line.factureId || !line.montantPaye || line.montantPaye <= 0) {
          continue;
        }

        // Get invoice details
        const invoice = await (PurchaseInvoice as any).findOne({
          _id: line.factureId,
          societeId: tenantId,
        }).lean();

        if (!invoice) {
          continue;
        }

        // Calculate already paid amount (sum of all payments for this invoice)
        // Exclude payments on account
        const existingPayments = await (PaiementFournisseur as any).find({
          societeId: new mongoose.Types.ObjectId(tenantId),
          'lignes.factureId': new mongoose.Types.ObjectId(line.factureId),
          isPaymentOnAccount: { $ne: true }, // Exclude payments on account
        }).lean();

        let montantPayeAvant = 0;
        existingPayments.forEach((payment: any) => {
          if (payment.lignes && Array.isArray(payment.lignes)) {
            payment.lignes.forEach((l: any) => {
              if (l.factureId && l.factureId.toString() === line.factureId.toString()) {
                montantPayeAvant += (l.montantPaye || 0);
              }
            });
          }
        });

        // Round to 3 decimal places to avoid floating point precision issues
        montantPayeAvant = Math.round(montantPayeAvant * 1000) / 1000;

        const montantFacture = invoice.totaux.totalTTC || 0;
        const montantPaye = parseFloat(line.montantPaye) || 0;

        // Calculate remaining balance BEFORE this payment
        const soldeRestantAvant = montantFacture - montantPayeAvant;

        // Round values to 3 decimal places to avoid floating point precision issues
        const roundedMontantFacture = Math.round(montantFacture * 1000) / 1000;
        const roundedMontantPayeAvant = Math.round(montantPayeAvant * 1000) / 1000;
        const roundedMontantPaye = Math.round(montantPaye * 1000) / 1000;
        const roundedSoldeRestantAvant = Math.round(soldeRestantAvant * 1000) / 1000;

        // Validate: the payment amount should not exceed the remaining balance
        // Allow payment if amount equals or is less than remaining balance
        // Use a small tolerance (0.001) to handle floating point precision issues
        if (roundedMontantPaye > roundedSoldeRestantAvant + 0.001) {
          return NextResponse.json(
            {
              error: `Le montant payé (${roundedMontantPaye.toFixed(3)}) dépasse le solde restant (${roundedSoldeRestantAvant.toFixed(3)}) de la facture ${invoice.numero}`
            },
            { status: 400 }
          );
        }

        // Also validate: total paid should not exceed invoice total (safety check)
        // Allow if total equals invoice total (full payment) or is less
        // Use a small tolerance (0.001) to handle floating point precision issues
        if (roundedMontantPayeAvant + roundedMontantPaye > roundedMontantFacture + 0.001) {
          return NextResponse.json(
            {
              error: `Le montant total payé (${(roundedMontantPayeAvant + roundedMontantPaye).toFixed(3)}) dépasse le montant de la facture (${roundedMontantFacture.toFixed(3)}) ${invoice.numero}`
            },
            { status: 400 }
          );
        }

        const soldeRestant = roundedSoldeRestantAvant - roundedMontantPaye;

        lignes.push({
          factureId: line.factureId,
          numeroFacture: invoice.numero,
          referenceFournisseur: invoice.referenceFournisseur || '',
          montantFacture,
          montantPayeAvant,
          montantPaye,
          soldeRestant: Math.max(0, soldeRestant),
          isPaymentOnAccount: false,
        });

        factureIds.push(line.factureId);
      }

      if (lignes.length === 0) {
        return NextResponse.json(
          { error: 'Aucune facture valide à régler' },
          { status: 400 }
        );
      }
    }

    // Calculate total
    const montantTotal = lignes.reduce((sum, ligne) => sum + ligne.montantPaye, 0);

    // For payment on account, ensure factureId is not included in the object at all
    const cleanedLignes = lignes.map((ligne: any) => {
      if (ligne.isPaymentOnAccount) {
        // For payment on account, create a clean object without factureId
        // This ensures Mongoose doesn't try to validate it
        const cleaned: any = {
          numeroFacture: 'PAIEMENT SUR COMPTE',
          referenceFournisseur: '',
          montantFacture: 0,
          montantPayeAvant: 0,
          montantPaye: ligne.montantPaye,
          soldeRestant: 0,
          isPaymentOnAccount: true,
        };
        // Explicitly ensure factureId is not in the object
        if ('factureId' in cleaned) {
          delete cleaned.factureId;
        }
        return cleaned;
      }
      // For regular payments, ensure factureId exists
      if (!ligne.factureId) {
        throw new Error('factureId est requis pour les paiements sur factures');
      }
      return ligne;
    });

    // Generate initial payment number
    let numero = await generateNextPaymentNumber();

    // Retry logic for handling duplicate key errors
    let paiement: any = null;
    let retryCount = 0;
    const maxRetries = 50; // Increased retries

    // Function to handle collision (find max with same prefix and jump)
    const jumpToMaxNumber = async (currentNumero: string): Promise<string | null> => {
      const extracted = extractNumericPart(currentNumero);
      if (!extracted) return null;

      const { prefix, padding } = extracted;
      try {
        // Find the absolute highest number with this prefix
        const highestPayment = await (PaiementFournisseur as any).findOne({
          societeId: new mongoose.Types.ObjectId(tenantId),
          numero: { $regex: `^${escapeRegExp(prefix)}` }
        })
          .sort({ numero: -1 }) // Strict desc sort on string is mostly correct for padded numbers
          .lean();

        if (highestPayment && highestPayment.numero) {
          const highestExtracted = extractNumericPart(highestPayment.numero);
          if (highestExtracted && highestExtracted.number >= extracted.number) {
            // Found a higher number, increment from THAT
            const nextNum = highestExtracted.number + 1;
            const nextStr = prefix + nextNum.toString().padStart(padding, '0');
            console.log(`Collision detected on ${currentNumero}. Jumped to ${nextStr} (found max: ${highestPayment.numero})`);
            return nextStr;
          }
        }
      } catch (e) {
        console.error("Error in jumpToMaxNumber", e);
      }
      return null;
    };

    while (retryCount < maxRetries) {
      try {
        // Check if number already exists before attempting to save
        const existingPayment = await (PaiementFournisseur as any).findOne({
          societeId: new mongoose.Types.ObjectId(tenantId),
          numero: numero
        }).lean();

        if (existingPayment) {
          // Number exists
          retryCount++;

          if (retryCount >= maxRetries) {
            break; // Will trigger error response below
          }

          // Try to jump to the max number to avoid step-by-step increments
          const nextNum = await jumpToMaxNumber(numero);
          if (nextNum) {
            numero = nextNum;
          } else {
            // Fallback to simple increment
            const incremented = incrementPaymentNumber(numero);
            numero = incremented || await generateNextPaymentNumber();
          }

          // Small delay
          await new Promise(resolve => setTimeout(resolve, 50));
          continue; // Skip to next iteration
        }

        // Number doesn't exist, proceed with creation
        const paiementData: any = {
          societeId: new mongoose.Types.ObjectId(tenantId),
          numero,
          datePaiement: body.datePaiement ? new Date(body.datePaiement) : new Date(),
          fournisseurId: new mongoose.Types.ObjectId(body.fournisseurId),
          fournisseurNom,
          modePaiement: body.modePaiement || 'Espèces',
          reference: body.reference || '',
          montantTotal,
          lignes: cleanedLignes,
          images: Array.isArray(body.images) ? body.images : [],
          notes: body.notes || '',
          createdBy: session.user.email,
          isPaymentOnAccount: isPaymentOnAccount,
          // Track advance usage if applicable
          advanceUsed: useAdvanceBalance ? advanceAmount : 0,
        };

        paiement = new PaiementFournisseur(paiementData);

        // Force Mongoose to recognize images as modified if present
        if (Array.isArray(paiementData.images) && paiementData.images.length > 0) {
          paiement.images = [];
          paiementData.images.forEach((img: any) => {
            paiement.images.push({
              id: img.id || `${Date.now()}-${Math.random()}`,
              name: img.name || '',
              url: img.url || '',
              publicId: img.publicId || undefined,
              type: img.type || 'image/jpeg',
              size: img.size || 0,
              width: img.width || undefined,
              height: img.height || undefined,
              format: img.format || undefined,
            });
          });
          (paiement as any).markModified('images');
        }

        // Save with validation
        await paiement.save({ validateBeforeSave: true });

        // Success! Exit retry loop
        break;
      } catch (saveError: any) {
        // Check if it's a duplicate key error (race condition - number was created between check and save)
        if (saveError.code === 11000 && saveError.keyPattern && saveError.keyPattern.numero) {
          // Duplicate key error on numero field
          retryCount++;

          if (retryCount >= maxRetries) {
            break;
          }

          // Try to jump to max number
          const nextNum = await jumpToMaxNumber(numero);
          if (nextNum) {
            numero = nextNum;
          } else {
            const incremented = incrementPaymentNumber(numero);
            numero = incremented || await generateNextPaymentNumber();
          }

          // Small delay
          await new Promise(resolve => setTimeout(resolve, 50));
        } else {
          // Different error, re-throw it
          throw saveError;
        }
      }
    }

    if (!paiement) {
      return NextResponse.json(
        { error: 'Impossible de créer le paiement. Veuillez réessayer.' },
        { status: 500 }
      );
    }

    // Handle advance balance usage
    // When we use advance balance to pay an invoice, we simply mark advanceUsed in the payment.
    // The netAdvanceBalance is calculated as: totalPaymentsOnAccount - totalAdvanceUsed
    // We DON'T create a new payment on account for the remaining balance, as that would double-count.
    // The remaining balance is automatically calculated when we compute netAdvanceBalance.

    // Note: We no longer create a payment on account for the remaining advance.
    // The calculation of netAdvanceBalance in /api/suppliers/[id]/balance will automatically
    // show the correct remaining balance by subtracting advanceUsed from totalPaymentsOnAccount.

    // Update invoice statuses only if not payment on account
    if (!isPaymentOnAccount) {
      for (const line of lignes) {
        if (line.factureId && !line.isPaymentOnAccount) {
          const invoice = await (PurchaseInvoice as any).findOne({
            _id: line.factureId,
            societeId: tenantId,
          });

          if (invoice) {
            const totalPaye = (line.montantPayeAvant || 0) + line.montantPaye;

            if (totalPaye >= (line.montantFacture || 0)) {
              invoice.statut = 'PAYEE';
            } else if (totalPaye > 0) {
              invoice.statut = 'PARTIELLEMENT_PAYEE';
            }

            // Add payment to invoice payments array if it exists
            if (!invoice.paiements) {
              invoice.paiements = [];
            }
            invoice.paiements.push({
              date: paiement.datePaiement,
              montant: line.montantPaye,
              mode: paiement.modePaiement,
              notes: `Paiement ${paiement.numero}`,
            });

            await invoice.save();
          }
        }
      }
    }

    return NextResponse.json(paiement, { status: 201 });
  } catch (error) {
    console.error('Erreur POST /api/purchases/payments:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

