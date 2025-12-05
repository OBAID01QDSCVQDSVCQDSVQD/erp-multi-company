import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import PaiementClient from '@/lib/models/PaiementClient';
import Document from '@/lib/models/Document';
import Customer from '@/lib/models/Customer';
import { NumberingService } from '@/lib/services/NumberingService';
import NotificationService from '@/lib/services/NotificationService';
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
    const customerId = searchParams.get('customerId') || '';

    const query: any = { societeId: new mongoose.Types.ObjectId(tenantId) };

    if (search) {
      query.$or = [
        { numero: { $regex: search, $options: 'i' } },
        { customerNom: { $regex: search, $options: 'i' } },
        { reference: { $regex: search, $options: 'i' } },
      ];
    }

    if (customerId) {
      query.customerId = new mongoose.Types.ObjectId(customerId);
    }

    const total = await PaiementClient.countDocuments(query);
    const paiements = await PaiementClient.find(query)
      .sort({ datePaiement: -1, numero: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Enrich payment lines with referenceExterne from invoices if missing
    const enrichedPaiements = await Promise.all(
      paiements.map(async (paiement: any) => {
        const enriched: any = {
          ...paiement,
          images: paiement.images || [], // Ensure images array is always present
        };
        
        if (paiement.lignes && paiement.lignes.length > 0) {
          const enrichedLignes = await Promise.all(
            paiement.lignes.map(async (ligne: any) => {
              // If referenceExterne is missing, fetch it from the invoice
              if (!ligne.referenceExterne && ligne.factureId) {
                // Search for both official invoices (FAC) and internal invoices (INT_FAC)
                const invoice = await (Document as any).findOne({
                  _id: ligne.factureId,
                  tenantId: tenantId,
                  type: { $in: ['FAC', 'INT_FAC'] },
                }).select('referenceExterne numero').lean();
                
                if (invoice) {
                  ligne.referenceExterne = invoice.referenceExterne || invoice.numero;
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
    console.error('Erreur GET /api/sales/payments:', error);
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
    const currentUserEmail = session.user.email as string | undefined;
    const body = await request.json();
    
    const {
      customerId,
      datePaiement,
      modePaiement,
      reference,
      notes,
    } = body;

    // Check if this is a payment on account
    const isPaymentOnAccount = body.isPaymentOnAccount === true;
    const montantOnAccount = parseFloat(body.montantOnAccount) || 0;
    let lignes = body.lignes || [];

    // Handle advance balance usage
    const useAdvanceBalance = body.useAdvanceBalance === true;
    const currentAdvanceBalance = parseFloat(body.currentAdvanceBalance) || 0;
    const advanceAmount = parseFloat(body.advanceAmount) || 0;
    const advanceUsed = useAdvanceBalance ? advanceAmount : (parseFloat(body.advanceUsed) || 0);

    if (!customerId) {
      return NextResponse.json(
        { error: 'Veuillez sélectionner un client' },
        { status: 400 }
      );
    }
    
    if (!datePaiement) {
      return NextResponse.json(
        { error: 'Veuillez saisir la date de paiement' },
        { status: 400 }
      );
    }
    
    if (!modePaiement) {
      return NextResponse.json(
        { error: 'Veuillez sélectionner un mode de paiement' },
        { status: 400 }
      );
    }

    // For payment on account, lignes can be empty or have a single line with montantPaye
    if (isPaymentOnAccount) {
      if (montantOnAccount <= 0) {
        return NextResponse.json(
          { error: 'Le montant du paiement sur compte doit être supérieur à zéro' },
          { status: 400 }
        );
      }
      // Create a single line for payment on account
      if (!lignes || lignes.length === 0) {
        lignes = [{ montantPaye: montantOnAccount }];
      }
    } else {
      // For regular payments, lignes must not be empty
      if (!lignes || lignes.length === 0) {
        return NextResponse.json(
          { error: 'Veuillez sélectionner au moins une facture à régler' },
          { status: 400 }
        );
      }
    }

    // Get customer info
    const customer = await (Customer as any).findOne({
      _id: customerId,
      tenantId,
    }).lean();

    if (!customer) {
      return NextResponse.json({ error: 'Client non trouvé' }, { status: 404 });
    }

    const customerNom = customer.raisonSociale || `${customer.nom || ''} ${customer.prenom || ''}`.trim();

    // Generate payment number
    const numero = await NumberingService.next(tenantId, 'pac');

    // Process payment lines
    const processedLignes = await Promise.all(
      lignes.map(async (ligne: any) => {
        if (ligne.factureId) {
          // Payment for specific invoice
          // Search for both official invoices (FAC) and internal invoices (INT_FAC)
          const invoice = await (Document as any).findOne({
            _id: ligne.factureId,
            tenantId,
            type: { $in: ['FAC', 'INT_FAC'] },
          }).lean();

          if (!invoice) {
            throw new Error(`Facture ${ligne.factureId} non trouvée`);
          }

          // Check if this is an internal invoice (INT_FAC) that has been converted
          // If converted, prevent adding payments (payments should be added via the official invoice)
          if (invoice.type === 'INT_FAC') {
            const hasConversionNote = invoice.notesInterne?.includes('Convertie en facture officielle');
            if (hasConversionNote || invoice.archived) {
              throw new Error(
                `Cette facture interne (${invoice.numero}) a été convertie en facture officielle. ` +
                `Les paiements doivent être ajoutés via la facture officielle.`
              );
            }
          }

          // Get all previous payments for this invoice
          const previousPayments = await (PaiementClient as any).find({
            societeId: new mongoose.Types.ObjectId(tenantId),
            'lignes.factureId': ligne.factureId,
          }).lean();

          let montantPayeAvant = 0;
          previousPayments.forEach((payment: any) => {
            payment.lignes.forEach((line: any) => {
              if (line.factureId && line.factureId.toString() === ligne.factureId.toString()) {
                montantPayeAvant += line.montantPaye;
              }
            });
          });

          const montantFacture = invoice.totalTTC || invoice.totalBaseHT || 0;
          
          // Debug logging
          console.log(`Invoice ${invoice.numero}: montantFacture=${montantFacture}, montantPayeAvant=${montantPayeAvant}, montantPaye=${ligne.montantPaye}`);
          
          const roundedMontantPayeAvant = Math.round(montantPayeAvant * 1000) / 1000;
          const roundedMontantPaye = Math.round(ligne.montantPaye * 1000) / 1000;
          const roundedSoldeRestantAvant = Math.round((montantFacture - roundedMontantPayeAvant) * 1000) / 1000;

          // Validate payment amount
          if (roundedMontantPaye > roundedSoldeRestantAvant + 0.001) {
            throw new Error(
              `Le montant payé (${roundedMontantPaye}) ne peut pas être supérieur au solde restant (${roundedSoldeRestantAvant}). ` +
              `Détails: Montant facture=${montantFacture}, Montant payé avant=${roundedMontantPayeAvant}, Solde restant=${roundedSoldeRestantAvant}`
            );
          }
          
          // Additional validation: ensure montantFacture is valid
          if (montantFacture <= 0) {
            throw new Error(
              `Le montant de la facture est invalide (${montantFacture}). Veuillez vérifier la facture.`
            );
          }

          const soldeRestant = Math.max(0, montantFacture - roundedMontantPayeAvant - roundedMontantPaye);

          return {
            factureId: ligne.factureId,
            numeroFacture: invoice.numero,
            referenceExterne: invoice.referenceExterne || invoice.numero,
            montantFacture,
            montantPayeAvant: roundedMontantPayeAvant,
            montantPaye: roundedMontantPaye,
            soldeRestant,
            isPaymentOnAccount: false,
          };
        } else {
          // Payment on account
          return {
            montantPaye: ligne.montantPaye,
            isPaymentOnAccount: true,
          };
        }
      })
    );

    // Calculate total amount
    const montantTotal = processedLignes.reduce((sum, ligne) => sum + (ligne.montantPaye || 0), 0);

    // Create payment document
    const paiement = new PaiementClient({
      societeId: new mongoose.Types.ObjectId(tenantId),
      numero,
      datePaiement: new Date(datePaiement),
      customerId: new mongoose.Types.ObjectId(customerId),
      customerNom,
      modePaiement,
      reference,
      montantTotal,
      lignes: processedLignes,
      images: Array.isArray(body.images) ? body.images : [],
      notes,
      isPaymentOnAccount: processedLignes.every((l) => l.isPaymentOnAccount),
      advanceUsed: Math.round(advanceUsed * 1000) / 1000, // Round to 3 decimal places
      createdBy: session.user.email,
    });

    // Force Mongoose to recognize images as modified if present
    if (Array.isArray(body.images) && body.images.length > 0) {
      paiement.images = [];
      body.images.forEach((img: any) => {
        const imageObj = {
          id: img.id || `${Date.now()}-${Math.random()}`,
          name: img.name || '',
          url: img.url || '',
          publicId: img.publicId || undefined,
          type: img.type || 'image/jpeg',
          size: img.size || 0,
          width: img.width || undefined,
          height: img.height || undefined,
          format: img.format || undefined,
        };
        paiement.images.push(imageObj);
      });
      (paiement as any).markModified('images');
    }

    await paiement.save();

    // ------------------------------------------------------------------
    // Notifications: informer المستخدم بحالة الفواتير بعد الدفع
    // ------------------------------------------------------------------
    try {
      if (currentUserEmail) {
        const { default: User } = await import('@/lib/models/User');
        const currentUser = await (User as any).findOne({
          email: currentUserEmail,
          companyId: new mongoose.Types.ObjectId(tenantId),
          isActive: true,
        }).lean();

        if (currentUser) {
          const userId = currentUser._id.toString();

          // فقط الخطوط المرتبطة بفواتير (مش paiement sur compte)
          const invoiceLines = processedLignes.filter(
            (l: any) => l.factureId && !l.isPaymentOnAccount
          );

          await Promise.all(
            invoiceLines.map((l: any) => {
              const numero = l.numeroFacture || l.referenceExterne || 'Facture';
              const montantFacture = l.montantFacture || 0;
              const montantPaye = l.montantPaye || 0;
              const soldeRestant = typeof l.soldeRestant === 'number' ? l.soldeRestant : 0;

              const isFullyPaid = soldeRestant <= 0.001;
              const type = isFullyPaid ? 'invoice_paid' : 'invoice_partially_paid';

              const title = isFullyPaid
                ? `Facture ${numero} payée`
                : `Paiement partiel - ${numero}`;

              const message = isFullyPaid
                ? `Facture ${numero} réglée. Montant: ${montantFacture.toFixed(
                    3
                  )} TND.`
                : `Paiement de ${montantPaye.toFixed(
                    3
                  )} TND sur la facture ${numero}. Solde restant: ${soldeRestant.toFixed(
                    3
                  )} TND.`;

              const link = `/sales/invoices/${l.factureId}`;

              return NotificationService.notifyUser({
                tenantId,
                userId,
                userEmail: currentUserEmail,
                type,
                title,
                message,
                link,
                channel: 'in_app',
                createdBy: currentUserEmail,
                dedupeKey: `${type}_${numero}`,
              });
            })
          );
        }
      }
    } catch (notifError) {
      console.error('Erreur lors de la création des notifications de paiement:', notifError);
      // لا نمنع حفظ الدفع إذا التنبيه فشل
    }

    // Update invoice payment status
    for (const ligne of processedLignes) {
      if (ligne.factureId && !ligne.isPaymentOnAccount) {
        // Search for both official invoices (FAC) and internal invoices (INT_FAC)
        const invoice = await (Document as any).findOne({
          _id: ligne.factureId,
          tenantId,
          type: { $in: ['FAC', 'INT_FAC'] },
        });

        if (invoice) {
          // Calculate total paid amount for this invoice
          const allPayments = await (PaiementClient as any).find({
            societeId: new mongoose.Types.ObjectId(tenantId),
            'lignes.factureId': ligne.factureId,
          }).lean();

          let totalPaye = 0;
          allPayments.forEach((payment: any) => {
            payment.lignes.forEach((line: any) => {
              if (line.factureId && line.factureId.toString() === ligne.factureId.toString()) {
                totalPaye += line.montantPaye;
              }
            });
          });

          const montantFacture = invoice.totalTTC || 0;
          
          if (totalPaye >= montantFacture - 0.001) {
            invoice.statut = 'PAYEE';
          } else if (totalPaye > 0) {
            invoice.statut = 'PARTIELLEMENT_PAYEE';
          } else {
            invoice.statut = 'BROUILLON';
          }

          await invoice.save();
        }
      }
    }

    // Handle advance balance usage
    // When we use advance balance to pay an invoice, we simply mark advanceUsed in the payment.
    // The netAdvanceBalance is calculated as: totalPaymentsOnAccount - totalAdvanceUsed
    // We DON'T create a new payment on account for the remaining balance, as that would double-count.
    // The remaining balance is automatically calculated when we compute netAdvanceBalance.
    
    // Note: We no longer create a payment on account for the remaining advance.
    // The calculation of netAdvanceBalance in /api/customers/[id]/balance will automatically
    // show the correct remaining balance by subtracting advanceUsed from totalPaymentsOnAccount.

    return NextResponse.json(paiement, { status: 201 });
  } catch (error: any) {
    console.error('Erreur POST /api/sales/payments:', error);
    
    // Determine error message based on error type
    let errorMessage = 'Erreur lors de l\'enregistrement du paiement';
    
    if (error.message) {
      // Use the specific error message if available
      errorMessage = error.message;
    } else if (error.name === 'ValidationError') {
      errorMessage = 'Données invalides. Veuillez vérifier les informations saisies.';
    } else if (error.name === 'CastError') {
      errorMessage = 'Format de données invalide. Veuillez réessayer.';
    } else if (error.code === 11000) {
      errorMessage = 'Un paiement avec ce numéro existe déjà.';
    }
    
    // Return the specific error message instead of generic "Erreur serveur"
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: error.statusCode || 500 }
    );
  }
}

