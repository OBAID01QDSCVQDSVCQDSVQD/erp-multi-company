import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper function to convert number to words in French
function numberToWordsFr(num: number): string {
  if (num === 0) return 'zéro';
  
  const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
                 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];
  
  if (num < 20) return units[num];
  
  if (num < 100) {
    const ten = Math.floor(num / 10);
    const unit = num % 10;
    
    if (ten === 7 || ten === 9) {
      const base = ten === 7 ? 60 : 80;
      return tens[ten] + (unit > 0 ? '-' + units[10 + unit] : '');
    }
    
    return tens[ten] + (unit > 0 ? '-' + units[unit] : (ten === 8 ? 's' : ''));
  }
  
  if (num < 1000) {
    const hundred = Math.floor(num / 100);
    const remainder = num % 100;
    
    if (hundred === 1) {
      return remainder > 0 ? 'cent ' + numberToWordsFr(remainder) : 'cent';
    }
    
    return units[hundred] + ' cent' + (remainder > 0 ? ' ' + numberToWordsFr(remainder) : 's');
  }
  
  if (num < 1000000) {
    const thousand = Math.floor(num / 1000);
    const remainder = num % 1000;
    
    const thousandStr = thousand > 1 ? numberToWordsFr(thousand) + ' ' : '';
    return thousandStr + 'mille' + (remainder > 0 ? ' ' + numberToWordsFr(remainder) : '');
  }
  
  if (num < 1000000000) {
    const million = Math.floor(num / 1000000);
    const remainder = num % 1000000;
    
    const millionStr = million > 1 ? numberToWordsFr(million) + ' ' : '';
    return millionStr + 'million' + (million > 1 ? 's' : '') + (remainder > 0 ? ' ' + numberToWordsFr(remainder) : '');
  }
  
  return num.toString(); // Fallback for very large numbers
}

// Helper function to convert amount to words with decimals
function amountToWordsFr(amount: number, currency: string = 'Dinars'): string {
  const wholePart = Math.floor(amount);
  const decimalPart = Math.round((amount - wholePart) * 1000);
  
  let result = '';
  
  if (wholePart > 0) {
    result += numberToWordsFr(wholePart) + ' ' + currency;
    if (wholePart > 1 && currency.toLowerCase() !== 'dinars') {
      result += 's';
    }
  }
  
  if (decimalPart > 0) {
    if (wholePart > 0) {
      result += ' et ';
    }
    result += numberToWordsFr(decimalPart) + ' millime';
    if (decimalPart > 1) {
      result += 's';
    }
  }
  
  return result || 'zéro ' + currency;
}

interface QuoteLine {
  productId?: string;
  codeAchat?: string;
  categorieCode?: string;
  produit?: string;
  designation?: string;
  description?: string;
  descriptionProduit?: string;
  quantite: number;
  unite?: string;
  uomCode?: string;
  prixUnitaireHT: number;
  remisePct?: number;
  tvaPct?: number;
  estStocke?: boolean;
}

interface QuoteData {
  numero: string;
  dateDoc: string;
  dateValidite?: string;
  customerName?: string;
  customerAddress?: string;
  customerMatricule?: string;
  customerCode?: string;
  customerPhone?: string;
  devise: string;
  lignes: QuoteLine[];
  totalBaseHT: number;
  totalRemise?: number;
  totalTVA: number;
  timbreFiscal?: number;
  totalTTC: number;
  modePaiement?: string;
  notes?: string;
  documentType?: string; // New optional field for document type (DEVIS, Bon de commande, BON DE LIVRAISON, etc.)
  adresseLivraison?: string; // For purchase orders
  dateLivraisonPrevue?: string; // For delivery notes
  dateLivraisonReelle?: string; // For delivery notes
  lieuLivraison?: string; // For delivery notes
  moyenTransport?: string; // For delivery notes
}

interface CompanyInfo {
  nom: string;
  adresse: {
    rue: string;
    ville: string;
    codePostal: string;
    pays: string;
  };
  logoUrl?: string;
  enTete?: {
    slogan?: string;
    telephone?: string;
    email?: string;
    siteWeb?: string;
    matriculeFiscal?: string;
    registreCommerce?: string;
    capitalSocial?: string;
  };
  piedPage?: {
    texte?: string;
    conditionsGenerales?: string;
    mentionsLegales?: string;
    coordonneesBancaires?: {
      banque?: string;
      rib?: string;
      swift?: string;
    };
  };
}

function drawLogo(doc: jsPDF, base64: string | undefined, x: number = 15, y: number = 13, maxW: number = 45, maxH: number = 22): number {
  if (!base64) return y + maxH;

  try {
    const props = doc.getImageProperties(base64);
    const ratio = props.width / props.height;

    let w = maxW;
    let h = w / ratio;
    
    if (h > maxH) {
      h = maxH;
      w = h * ratio;
    }

    // Determine format from base64
    const format = base64.split(',')[0].split('/')[1].split(';')[0].toUpperCase();
    doc.addImage(base64, format, x, y, w, h);
    
    return y + h;
  } catch (error) {
    console.error('Error adding logo:', error);
    return y + maxH;
  }
}

function drawHeader(doc: jsPDF, companyInfo: CompanyInfo): number {
  // Fond header
  doc.setFillColor(244, 246, 251);
  doc.roundedRect(10, 10, 190, 32, 4, 4, 'F');

  // Logo à gauche
  const bottomLogo = drawLogo(doc, companyInfo.logoUrl, 15, 13, 45, 22);

  // Infos société à droite
  const rightX = 70;
  const topY = 15;
  doc.setFontSize(11).setFont('helvetica', 'bold');
  doc.text(companyInfo.nom, rightX, topY);

  doc.setFontSize(9).setFont('helvetica', 'normal');
  if (companyInfo.adresse.rue) {
    doc.text(companyInfo.adresse.rue, rightX, topY + 5);
  }
  
  if (companyInfo.enTete?.telephone || companyInfo.enTete?.email) {
    doc.text(
      [
        companyInfo.enTete.telephone ? `Tél : ${companyInfo.enTete.telephone}` : '',
        companyInfo.enTete.email ? `Email : ${companyInfo.enTete.email}` : '',
        companyInfo.enTete.siteWeb ? `Web : ${companyInfo.enTete.siteWeb}` : '',
      ]
        .filter(Boolean)
        .join('  |  '),
      rightX,
      topY + 10
    );
  }

  if (companyInfo.enTete?.matriculeFiscal) {
    doc.text(`Matricule : ${companyInfo.enTete.matriculeFiscal}`, rightX, topY + 15);
  }

  // Retourner la position Y dispo après le header
  return 10 + 32 + 4;
}

function drawDevisTitle(doc: jsPDF, documentType?: string): number {
  const startY = 10 + 32 + 8; // Position après le header + espace
  
  // Titre dynamique en gras, grand et bleu
  const title = documentType || 'DEVIS';
  doc.setFontSize(16).setFont('helvetica', 'bold');
  doc.setTextColor(47, 95, 255);
  doc.text(title, 10, startY);
  doc.setTextColor(0, 0, 0);
  
  return startY + 8;
}

function drawInfoBlocks(doc: jsPDF, quoteData: QuoteData, companyInfo: CompanyInfo, startY: number): number {
  const col1X = 12;
  const col2X = 75;
  const clientX = 120;
  const h = 28;

  // Determine document type
  const docType = quoteData.documentType?.toLowerCase() || '';
  const isInvoice = docType.includes('facture');
  const isCreditNote = docType.includes('avoir');
  const isDeliveryNote = docType.includes('livraison') || docType.includes('bon de livraison');
  const isPurchaseOrder = docType.includes('commande') && (docType.includes('achat') || docType.includes('réception') || docType.includes('reception'));
  const isQuote = !isDeliveryNote && !isPurchaseOrder && !isInvoice && !isCreditNote;
  
  // Set document number label based on type
  let docNumberLabel = 'Numéro de devis';
  if (isInvoice) {
    docNumberLabel = 'Numéro de facture';
  } else if (isCreditNote) {
    docNumberLabel = 'Numéro d\'avoir';
  } else if (isDeliveryNote) {
    docNumberLabel = 'Numéro de bon de livraison';
  } else if (isPurchaseOrder) {
    docNumberLabel = 'Numéro de commande';
  }
  
  doc.setFontSize(9).setFont('helvetica', 'normal');
  doc.text(docNumberLabel, col1X, startY + 4);
  doc.setTextColor(47, 95, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(quoteData.numero, col1X, startY + 10);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  
  // Show different fields based on document type
  if (isInvoice) {
    // For invoices, show dateEcheance (due date)
    if (quoteData.dateValidite) { // dateValidite is used for dateEcheance in invoices
      doc.text('Date échéance', col1X, startY + 17);
      doc.text(new Date(quoteData.dateValidite).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }), col1X, startY + 23);
    }
  } else if (isCreditNote) {
    doc.text('Date avoir', col1X, startY + 17);
    doc.text(new Date(quoteData.dateDoc).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }), col1X, startY + 23);
  } else if (isDeliveryNote) {
    // For delivery notes, show dateLivraisonPrevue or lieuLivraison
    if (quoteData.dateLivraisonPrevue) {
      doc.text('Date livraison prévue', col1X, startY + 17);
      doc.text(new Date(quoteData.dateLivraisonPrevue).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }), col1X, startY + 23);
    } else if (quoteData.lieuLivraison) {
      doc.text('Lieu de livraison', col1X, startY + 17);
      doc.text(quoteData.lieuLivraison, col1X, startY + 23);
    }
  } else if (isPurchaseOrder && quoteData.adresseLivraison) {
    // For purchase orders, show adresseLivraison
    doc.text('Adresse livraison', col1X, startY + 17);
    doc.text(quoteData.adresseLivraison, col1X, startY + 23);
  } else if (isQuote) {
    // For quotes, show validité
    doc.text('Validité', col1X, startY + 17);
    const validite = quoteData.dateValidite 
      ? new Date(quoteData.dateValidite).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : 'N/A';
    doc.text(validite, col1X, startY + 23);
  }

  // Date
  doc.text('Date', col2X, startY + 4);
  doc.setFont('helvetica', 'bold');
  doc.text(new Date(quoteData.dateDoc).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }), col2X, startY + 10);
  doc.setFont('helvetica', 'normal');

  // Bloc client/fournisseur à droite
  // Delivery notes and quotes are for clients, purchase orders are for suppliers
  const partyLabel = isPurchaseOrder ? 'Fournisseur' : 'Client';
  doc.setFillColor(238, 244, 255);
  
  // Calculate dynamic height based on content
  let textY = startY + 12;
  let dynamicHeight = 6; // Start with label height
  
  // Calculate height needed for address (with wrapping)
  let addressLines = 0;
  if (quoteData.customerAddress) {
    const addressText = `Adresse: ${quoteData.customerAddress}`;
    const addressWidth = 72; // 80 - 4 (margin) - 4 (padding)
    const splitAddress = doc.splitTextToSize(addressText, addressWidth);
    addressLines = splitAddress.length;
    dynamicHeight += 5 + (addressLines * 4); // Name height + address lines
  } else {
    dynamicHeight += 5; // Just name height
  }
  
  // Add phone height if exists
  if (quoteData.customerPhone) {
    dynamicHeight += 5;
  }
  
  // Ensure minimum height
  dynamicHeight = Math.max(dynamicHeight, h);
  
  // Draw the box with dynamic height
  doc.roundedRect(clientX, startY, 80, dynamicHeight, 3, 3, 'F');
  
  // Draw text content
  doc.setFontSize(9).setFont('helvetica', 'bold');
  doc.text(partyLabel, clientX + 4, startY + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(quoteData.customerName || '—', clientX + 4, textY);
  textY += 5;
  
  // Address with wrapping
  if (quoteData.customerAddress) {
    const addressText = `Adresse: ${quoteData.customerAddress}`;
    const addressWidth = 72;
    const splitAddress = doc.splitTextToSize(addressText, addressWidth);
    splitAddress.forEach((line: string, idx: number) => {
      doc.text(line, clientX + 4, textY + (idx * 4));
    });
    textY += splitAddress.length * 4;
  }
  
  // Phone
  if (quoteData.customerPhone) {
    doc.text(`Tél: ${quoteData.customerPhone}`, clientX + 4, textY);
  }

  return startY + dynamicHeight + 6;
}

// Helper function to parse HTML and convert to plain text with line breaks
function parseHtml(html: string): string {
  if (!html) return '';
  
  // Convert <br> to newlines first, then strip all HTML tags
  let text = html.replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '') // Remove all HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n\s*\n/g, '\n') // Remove multiple newlines
    .trim();
  
  return text;
}

function drawLinesTable(doc: jsPDF, quoteData: QuoteData, startY: number): number {
  const body = quoteData.lignes.map((l, index) => {
    const quantRaw = typeof l.quantite === 'number' ? l.quantite : parseFloat(String(l.quantite || 0));
    const quantite = Math.abs(Number.isFinite(quantRaw) ? quantRaw : 0);
    const puRaw = typeof l.prixUnitaireHT === 'number' ? l.prixUnitaireHT : parseFloat(String(l.prixUnitaireHT || 0));
    const prixUnitaire = Number.isFinite(puRaw) ? puRaw : 0;
    const remiseRaw = typeof l.remisePct === 'number' ? l.remisePct : parseFloat(String(l.remisePct || 0));
    const remise = Number.isFinite(remiseRaw) ? remiseRaw : 0;
    const tvaRaw = typeof l.tvaPct === 'number' ? l.tvaPct : parseFloat(String(l.tvaPct || 0));
    const tvaPct = Number.isFinite(tvaRaw) ? tvaRaw : 0;
    const prixHTAfterDiscount = prixUnitaire * (1 - remise / 100);
    const montantHT = prixHTAfterDiscount * quantite;
    const montantTTC = montantHT * (1 + tvaPct / 100);
    const ref =
      l.codeAchat ||
      l.categorieCode ||
      l.produit ||
      l.designation ||
      `Ligne ${index + 1}`;
    
    let displayText = '';
    if (l.estStocke === false && l.descriptionProduit) {
      displayText = parseHtml(l.descriptionProduit);
    } else {
      displayText = parseHtml(l.produit || l.designation || l.description || '');
    }
    if (!displayText) {
      displayText = ref || `Produit ${index + 1}`;
    }
    
    return [
      ref || `Ligne ${index + 1}`,
      displayText,
      quantite.toString(),
      `${prixUnitaire.toFixed(3)}`,
      `${remise} %`,
      `${tvaPct || 0} %`,
      `${montantHT.toFixed(3)}`,
      `${montantTTC.toFixed(3)}`,
    ];
  });

  autoTable(doc, {
    startY,
    head: [[
      'Réf',
      'Produit',
      'Qté',
      'Prix HT',
      'Remise %',
      'TVA',
      'Total HT',
      'Total TTC'
    ]],
    body,
    // مهم: نفس مارجين الهيدر (للصفحة الأولى فقط)
    margin: { top: startY, left: 10, right: 10 },
    // نجبره على العرض الكامل
    tableWidth: 190,
    // إضافة رأس الجدول في كل صفحة
    showHead: 'everyPage',
    willDrawPage: (data: any) => {
      // For subsequent pages, adjust the start position to top
      if (data.pageNumber > 1) {
        data.cursor.y = 10;
      }
    },
    styles: {
      fontSize: 9,
      cellPadding: 3,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [232, 241, 255],
      textColor: 0,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [252, 252, 252],
    },
    // نقسم الـ 190 على الكولونات
    columnStyles: {
      0: { cellWidth: 18 },              // Réf
      1: { cellWidth: 70 },              // Produit
      2: { cellWidth: 12, halign: 'right' }, // Qté
      3: { cellWidth: 22, halign: 'right' }, // Prix HT
      4: { cellWidth: 16, halign: 'right' }, // Remise %
      5: { cellWidth: 14, halign: 'right' }, // TVA
      6: { cellWidth: 19, halign: 'right' }, // Total HT
      7: { cellWidth: 19, halign: 'right' }, // Total TTC
    },
    theme: 'grid',
  });

  // نرجع آخر Y
  return (doc as any).lastAutoTable.finalY + 6;
}

function drawTotals(doc: jsPDF, quoteData: QuoteData, startY: number, maxHeightBeforeFooter: number): void {
  const x = 125;
  const w = 75;
  const lineH = 6;
  const currencySymbol = quoteData.devise === 'TND' ? ' DT' : ` ${quoteData.devise}`;
  
  // Determine if this is a delivery note
  const docType = quoteData.documentType?.toLowerCase() || '';
  const isDeliveryNote = docType.includes('livraison') || docType.includes('bon de livraison');

  const rows: Array<[string, number | undefined]> = [
    ['Total HT', quoteData.totalBaseHT],
    ['Total Remise', quoteData.totalRemise],
    ['Total TVA', quoteData.totalTVA],
    // Skip Timbre fiscal for delivery notes
    ...(isDeliveryNote ? [] : [['Timbre fiscal', quoteData.timbreFiscal] as [string, number | undefined]]),
  ];

  // Calculate box height (only for totals, without Arrêté and Mode de paiement)
  const validRows = rows.filter(([label, val]) => {
    if (!val && val !== 0) return false;
    if (label === 'Total Remise' && val === 0) return false;
    if (label === 'Total TVA' && val === 0) return false;
    // Skip Timbre fiscal for delivery notes (should not appear at all)
    if (label === 'Timbre fiscal' && isDeliveryNote) return false;
    return true;
  });
  
  const totalBoxH = 6 + (validRows.length * lineH) + 6 + 7;

  // Position the totals box above the footer
  // Make sure it doesn't exceed maxHeightBeforeFooter
  const totalsY = maxHeightBeforeFooter - totalBoxH;
  const actualStartY = Math.min(startY, totalsY);

  doc.setFillColor(245, 246, 251);
  doc.roundedRect(x, actualStartY, w, totalBoxH, 3, 3, 'F');

  doc.setFontSize(9);
  let y = actualStartY + 6;
  
  rows.forEach(([label, val]) => {
    // Skip if undefined/null
    if (!val && val !== 0) return;
    // Skip Total Remise and Total TVA if value is 0
    if ((label === 'Total Remise' || label === 'Total TVA') && val === 0) return;

    doc.setFont('helvetica', 'normal');
    doc.text(label, x + 4, y);
    
    // Special color for remise (red if negative)
    if (label === 'Total Remise' && val && val < 0) {
      doc.setTextColor(255, 0, 0);
    } else {
      doc.setTextColor(0, 0, 0);
    }
    
    doc.setFont('helvetica', 'bold');
    const value = (val || 0).toFixed(3);
    doc.text(`${Math.abs(val || 0).toFixed(3)}${currencySymbol}`, x + w - 4, y, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    y += lineH;
  });

  // Ligne
  doc.setDrawColor(220, 220, 220);
  doc.line(x + 4, y + 1, x + w - 4, y + 1);

  // Total TTC en bleu
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(47, 95, 255);
  doc.text('Total TTC', x + 4, y + 7);
  doc.text(`${quoteData.totalTTC.toFixed(3)}${currencySymbol}`, x + w - 4, y + 7, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  
  // Arrêté à la somme de (outside the box, below it)
  const boxBottomY = actualStartY + totalBoxH;
  const currencyName = quoteData.devise === 'TND' ? 'Dinars tunisiens' : quoteData.devise;
  const amountInWords = amountToWordsFr(quoteData.totalTTC, currencyName);
  const maxWidth = 190; // Full page width minus margins (200 - 10)
  const splitText = doc.splitTextToSize(`Arrêté à la somme de : ${amountInWords}`, maxWidth);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(102, 102, 102);
  
  splitText.forEach((line: string, idx: number) => {
    doc.text(line, 10, boxBottomY + 5 + (idx * 4));
  });

  // Mode de paiement (outside the box, below Arrêté)
  if (quoteData.modePaiement) {
    const modePaiementY = boxBottomY + 5 + (splitText.length * 4) + 3;
    doc.text(`Mode de paiement : ${quoteData.modePaiement}`, 10, modePaiementY);
  }
  doc.setTextColor(0, 0, 0);
}

function drawFooter(doc: jsPDF, companyInfo: CompanyInfo, footerY: number, pageNumber?: number, totalPages?: number): void {
  // Draw horizontal line at fixed position
  doc.setDrawColor(220, 220, 220);
  doc.line(10, footerY, 200, footerY);
  
  const yPos = footerY + 6;
  doc.setFontSize(9).setTextColor(0, 0, 0);

  // Build footer items
  const footerItems: string[] = [];

  // Adresse
  const addressParts = [
    companyInfo.adresse.rue,
    companyInfo.adresse.ville,
    companyInfo.adresse.codePostal,
    companyInfo.adresse.pays
  ].filter(Boolean);
  if (addressParts.length > 0) {
    footerItems.push(addressParts.join(', '));
  }

  // Téléphone
  if (companyInfo.enTete?.telephone) {
    footerItems.push(`Tél : ${companyInfo.enTete.telephone}`);
  }

  // Capital social
  if (companyInfo.enTete?.capitalSocial) {
    footerItems.push(`Capital social : ${companyInfo.enTete.capitalSocial}`);
  }

  // Banque + RIB (sur une même ligne)
  const banc = companyInfo.piedPage?.coordonneesBancaires;
  if (banc?.banque || banc?.rib) {
    const banquePart = banc.banque ? banc.banque : '';
    const ribPart = banc.rib ? `RIB : ${banc.rib}` : '';
    if (banquePart && ribPart) {
      footerItems.push(`${banquePart}, ${ribPart}`);
    } else if (banquePart) {
      footerItems.push(banquePart);
    } else if (ribPart) {
      footerItems.push(ribPart);
    }
  }

  // Join all items with " - " and center
  if (footerItems.length > 0) {
    const footerText = footerItems.join(' - ');
    const centerX = 105; // Center of A4 page (210mm / 2)
    doc.text(footerText, centerX, yPos, { align: 'center' });
  }
  
  // Add page number if provided
  if (pageNumber !== undefined && totalPages !== undefined) {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    const pageText = `Page ${pageNumber} / ${totalPages}`;
    doc.text(pageText, 200 - 20, footerY - 5, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }
}

export function generateDevisPdf(quoteData: QuoteData, companyInfo: CompanyInfo): jsPDF {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageHeight = 297; // A4 height in mm
  const footerY = 280; // Fixed footer position at 280mm from top

  let y = drawHeader(doc, companyInfo);
  y = drawDevisTitle(doc, quoteData.documentType);
  y = drawInfoBlocks(doc, quoteData, companyInfo, y);
  const tableEndY = drawLinesTable(doc, quoteData, y);
  
  // Get total number of pages after table is drawn
  const pageCount = doc.getNumberOfPages();
  
  // Check if there's enough space on the last page for totals box
  // Calculate approximate totals box height + Arrêté + Mode de paiement
  const currencyName = quoteData.devise === 'TND' ? 'Dinars tunisiens' : quoteData.devise;
  const amountInWords = amountToWordsFr(quoteData.totalTTC, currencyName);
  const splitText = doc.splitTextToSize(`Arrêté à la somme de : ${amountInWords}`, 75);
  const totalBoxH = 6 + (4 * 6) + 6 + 7 + (splitText.length * 4) + (quoteData.modePaiement ? 3 : 0) + 5; // ~49mm + text
  const availableSpace = footerY - tableEndY - 3;
  
  // Draw footer and totals on all pages
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    // Draw footer on every page with page number
    drawFooter(doc, companyInfo, footerY, i, pageCount);
    
    // Draw totals only on the last page
    if (i === pageCount) {
      if (availableSpace < totalBoxH + 10) {
        // Not enough space, add a new page
        doc.addPage();
        drawTotals(doc, quoteData, 10, footerY - 3);
        drawFooter(doc, companyInfo, footerY, pageCount + 1, pageCount + 1);
      } else {
        // Enough space, draw totals on the last page
        drawTotals(doc, quoteData, tableEndY + 5, footerY - 3);
      }
    }
  }

  return doc;
}
