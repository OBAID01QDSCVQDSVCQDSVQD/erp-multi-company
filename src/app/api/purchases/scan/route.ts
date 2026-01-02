
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { uploadImageToCloudinary } from '@/lib/cloudinary';
import connectDB from '@/lib/mongodb';
import Product from '@/lib/models/Product';
import Supplier from '@/lib/models/Supplier';

import Subscription from '@/lib/models/Subscription';

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
        }

        const tenantId = request.headers.get('X-Tenant-Id');
        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 400 });
        }

        // Check Subscription
        await connectDB();
        const subscription = await (Subscription as any).findOne({
            companyId: tenantId,
            status: 'active'
        });

        // Uncomment this block to enforce subscription check in production
        /* 
        if (!subscription || subscription.plan === 'free') {
            return NextResponse.json({ 
                error: 'Cette fonctionnalité nécessite un abonnement Starter ou Premium.' 
            }, { status: 403 });
        }
        */

        // For development/demo purposes, we might want to allow it or mock it.
        // But since the user explicitly asked for it:
        if (!subscription || subscription.plan === 'free') {
            return NextResponse.json({
                error: 'Fonctionnalité réservée aux abonnés (Starter/Premium).'
            }, { status: 403 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 });
        }

        // 1. Upload to Cloudinary (Optional - Best Effort)
        let imageUrl = null;
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        try {
            const uploadResult = await uploadImageToCloudinary(buffer, 'erp-invoices');
            imageUrl = uploadResult.secure_url;
        } catch (uploadError) {
            console.warn("Cloudinary upload failed, proceeding with AI scan only:", uploadError);
        }

        // 2. Prepare OpenAI Call
        const openAiApiKey = process.env.OPENAI_API_KEY;
        if (!openAiApiKey) {
            return NextResponse.json({ error: 'Clé API OpenAI manquante configuration serveur (OPENAI_API_KEY)' }, { status: 500 });
        }

        console.log("Using OpenAI Model: gpt-4o");

        // Convert image to base64
        const base64Image = buffer.toString('base64');
        const dataUrl = `data:${file.type || 'image/jpeg'};base64,${base64Image}`;

        const promptSystem = `
      Tu es un expert comptable et assistant IA spécialisé dans l'extraction de données de factures.
      Ton rôle est d'analyser l'image de la facture fournie et d'extraire les données en format JSON strict.
      
      Structure JSON attendue:
      {
          "date": "YYYY-MM-DD",
          "numero": "Numéro de la facture",
          "supplierName": "Nom du fournisseur",
          "totalHT": 0.00,
          "totalTVA": 0.00,
          "totalTTC": 0.00,
          "fodec": {
            "present": false,
            "rate": 1
          },
          "lines": [
             {
               "designation": "Description exacte",
               "reference": "Code/REF du produit (si visible)",
               "quantity": 1.0,
               "unitPrice": 0.00,
               "tvaPct": 19,
               "remisePct": 0.00,
               "totalHT": 0.00
             }
          ]
      }
      
      IMPORTANT - RÈGLES CRITIQUES:
      1. FORMAT DES NOMBRES: La virgule (,) est le séparateur DÉCIMAL. "3,000" = 3 (et NON 3000). "125,000" = 125. Fais très attention à ne pas confondre milliers et décimales.
      2. REMISE: Cherche une colonne "Remise", "Rem", "%" ou "Disc". Extrais le pourcentage (ex: "35%" -> 35).
      3. TVA:
         - Cherche explicitement la colonne "TVA" ou "%".
         - Extrais la valeur numérique (ex: 7, 13, 19).
         - MEME SI le prix est 0, tu DOIS extraire le taux de TVA indiqué.
         - Si "Exonéré" ou 0%, mets 0.
      4. FODEC: Cherche le mot "FODEC" ou "Redevance Industrielle" dans les totaux. Si trouvé, mets "present": true et extrais le taux EXACT affiché à côté (ex: 1, 1.5, 2). Ne mets pas 1 par défaut, utilise la valeur réelle écrite sur la facture.
      5. Ne mets JAMAIS de markdown. Renvoie le JSON pur.
    `;

        try {
            const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${openAiApiKey}`
                },
                body: JSON.stringify({
                    model: "gpt-4o",
                    messages: [
                        {
                            role: "system",
                            content: promptSystem
                        },
                        {
                            role: "user",
                            content: [
                                { type: "text", text: "Analyse cette facture et extrais les données." },
                                {
                                    type: "image_url",
                                    image_url: {
                                        url: dataUrl
                                    }
                                }
                            ]
                        }
                    ],
                    max_tokens: 1500,
                    temperature: 0
                })
            });

            if (!openAiResponse.ok) {
                const errorText = await openAiResponse.text();
                throw new Error(`OpenAI API Error: ${openAiResponse.status} - ${errorText}`);
            }

            const aiData = await openAiResponse.json();
            const content = aiData.choices[0].message.content;

            // Clean content just in case
            const cleanText = content.replace(/```json/g, '').replace(/```/g, '').trim();

            let scannedData;
            try {
                scannedData = JSON.parse(cleanText);
            } catch (parseErr) {
                console.error("JSON Parse Error:", cleanText);
                return NextResponse.json({ error: 'Erreur lecture réponse IA', details: cleanText }, { status: 500 });
            }

            await connectDB();

            // 3. Match Supplier
            console.log("---- SMART SUPPLIER MATCHING ----");
            console.log("AI Name:", scannedData.supplierName);

            let matchedSupplier = null;
            if (scannedData.supplierName) {
                const aiNameNormalized = scannedData.supplierName.toUpperCase().replace('&', 'ET').replace(/[^A-Z0-9 ]/g, ' ');

                // 1. Try Exact/Contains Match first (Fastest) - Check both nom and raisonSociale
                matchedSupplier = await (Supplier as any).findOne({
                    tenantId,
                    $or: [
                        { nom: { $regex: scannedData.supplierName, $options: 'i' } },
                        { raisonSociale: { $regex: scannedData.supplierName, $options: 'i' } }
                    ]
                });

                // 2. If Failed, try "Candidate Search & Score"
                if (!matchedSupplier) {
                    // Stop words to ignore
                    const stopWords = ['SARL', 'SUARL', 'STE', 'SOCIETE', 'CIE', 'ET', 'LE', 'LA', 'LES', 'DES', 'DU', 'AU'];

                    // Extract significant words (len > 1)
                    const words = aiNameNormalized.split(' ').filter((w: string) => w.length > 1 && !stopWords.includes(w));

                    console.log("Search Words:", words);

                    if (words.length > 0) {
                        // Find potential candidates
                        const regexQuery = words.join('|');
                        // Increase limit to 500 to ensure we catch the right one even with common names like "Mohamed"
                        const candidates = await (Supplier as any).find({
                            tenantId,
                            $or: [
                                { nom: { $regex: regexQuery, $options: 'i' } },
                                { raisonSociale: { $regex: regexQuery, $options: 'i' } }
                            ]
                        }).limit(500);

                        console.log(`Found ${candidates.length} candidates using regex: ${regexQuery}`);

                        // Score candidates based on Jaccard Index (Token overlap)
                        let bestScore = 0;
                        let bestCandidate = null;

                        const aiTokens = new Set(aiNameNormalized.split(' '));

                        for (const cand of candidates) {
                            const candName = cand.raisonSociale || cand.nom || '';
                            const candNameNorm = candName.toUpperCase().replace('&', 'ET').replace(/[^A-Z0-9 ]/g, ' ');
                            const candTokens = new Set(candNameNorm.split(' '));

                            // Calculate intersection
                            let intersection = 0;
                            aiTokens.forEach(t => {
                                if (candTokens.has(t)) intersection++;
                            });

                            // Calculate union
                            const union = new Set([...aiTokens, ...candTokens]).size;

                            const score = union === 0 ? 0 : intersection / union;

                            // Log only high scores to avoid noise
                            if (score > 0.1) console.log(`- Candidate: "${candName}" | Score: ${score.toFixed(2)}`);

                            if (score > bestScore) {
                                bestScore = score;
                                bestCandidate = cand;
                            }
                        }

                        // Threshold: Lowered to 0.15
                        if (bestScore > 0.15) {
                            matchedSupplier = bestCandidate;
                            console.log("WINNER:", matchedSupplier.raisonSociale || matchedSupplier.nom);
                        }
                    }
                }
            }
            console.log("FINAL MATCH:", matchedSupplier ? (matchedSupplier.raisonSociale || matchedSupplier.nom) : "NONE");
            console.log("---------------------------------");

            // 4. Match Products (Smart Matching)
            const processedLines = await Promise.all(scannedData.lines.map(async (line: any) => {
                let matchedProduct = null;

                // A. Try match by Reference first
                if (line.reference) {
                    matchedProduct = await (Product as any).findOne({
                        tenantId,
                        $or: [
                            { sku: line.reference },
                            { referenceClient: line.reference },
                            { barcode: line.reference }
                        ]
                    });
                }

                // B. If no match, try by Designation
                if (!matchedProduct && line.designation) {
                    matchedProduct = await (Product as any).findOne({
                        tenantId,
                        $text: { $search: line.designation }
                    }, { score: { $meta: "textScore" } }).sort({ score: { $meta: "textScore" } });

                    if (!matchedProduct) {
                        const cleaningWords = line.designation.replace(/[^a-zA-Z0-9 ]/g, ' ');
                        const firstWords = cleaningWords.split(' ').filter((w: string) => w.length > 2).slice(0, 2).join(' ');

                        if (firstWords.length > 3) {
                            matchedProduct = await (Product as any).findOne({
                                tenantId,
                                nom: { $regex: firstWords, $options: 'i' }
                            });
                        }
                    }
                }

                return {
                    ...line,
                    productId: matchedProduct ? matchedProduct._id : null,
                    matchedProductName: matchedProduct ? matchedProduct.nom : null,
                    isNewProduct: !matchedProduct
                };
            }));

            return NextResponse.json({
                success: true,
                data: {
                    ...scannedData,
                    supplierId: matchedSupplier ? matchedSupplier._id : null,
                    supplierName: matchedSupplier ? (matchedSupplier.raisonSociale || matchedSupplier.nom) : scannedData.supplierName,
                    lines: processedLines
                },
                imageUrl,
                imageUploadError: imageUrl ? null : "L'image n'a pas pu être sauvegardée (Erreur Cloudinary ou Configuration manquante)"
            });

        } catch (apiError: any) {
            console.error('OpenAI Error:', apiError);
            return NextResponse.json(
                { error: apiError.message || 'Erreur OpenAI' },
                { status: 500 }
            );
        }

    } catch (error: any) {
        console.error('Server Error:', error);
        return NextResponse.json(
            { error: error.message || 'Erreur serveur' },
            { status: 500 }
        );
    }
}
