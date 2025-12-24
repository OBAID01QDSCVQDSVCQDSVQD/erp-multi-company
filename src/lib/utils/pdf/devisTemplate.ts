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
  // For credit notes: original invoice number
  referenceExterne?: string;
  devise: string;
  lignes: QuoteLine[];
  totalBaseHT: number;
  remiseLignes?: number;
  remiseGlobale?: number;
  remiseGlobalePct?: number;
  totalRemise?: number;
  fodec?: number;
  fodecTauxPct?: number;
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
  matriculeTransport?: string; // For delivery notes
  statut?: string; // For internal invoices: BROUILLON, VALIDEE, ANNULEE, etc.
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
  cachetUrl?: string;
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
    doc.addImage(base64, format, x, y, w, h, undefined, 'FAST');

    return y + h;
  } catch (error) {
    console.error('Error adding logo:', error);
    return y + maxH;
  }
}

function drawStamp(doc: jsPDF, base64: string | undefined, x: number, y: number, w: number = 40, h: number = 40): void {
  if (!base64) return;

  try {
    const props = doc.getImageProperties(base64);
    const ratio = props.width / props.height;

    // Adjust dimensions to maintain aspect ratio within bounds
    let finalW = w;
    let finalH = finalW / ratio;

    if (finalH > h) {
      finalH = h;
      finalW = finalH * ratio;
    }

    // Determine format
    const format = base64.split(',')[0].split('/')[1].split(';')[0].toUpperCase();
    doc.addImage(base64, format, x, y, finalW, finalH, undefined, 'FAST');
  } catch (error) {
    console.error('Error adding stamp:', error);
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

  return 10 + 32 + 4;
}

function drawNotes(doc: jsPDF, notes: string | undefined, startY: number): number {
  if (!notes) return startY;

  doc.setFontSize(9);

  // Clean raw notes string
  let cleanNotes = notes.trim();

  // Check if it's a return warning (starts with [)
  if (cleanNotes.startsWith('[')) {
    // Replace emojis and clean up text for PDF standard fonts
    // ⚠️ is often followed by a variation selector, so we handle that.
    cleanNotes = cleanNotes
      .replace(/⚠️/g, 'ATTENTION :')
      .replace(/[^\x20-\x7E\xA0-\xFF\u0100-\u017F\u20AC]/g, '') // Keep basic Latin, accents, Euro sign
      .replace(/\[\s*/, '') // Remove opening bracket
      .replace(/\s*\]$/, ''); // Remove closing bracket

    // Alert Style
    const splitNotes = doc.splitTextToSize(cleanNotes, 170); // Margin 20 (more padding)
    const lineHeight = 5;
    const padding = 4;
    const height = (splitNotes.length * lineHeight) + (padding * 2);

    // Draw light background for alert
    doc.setFillColor(255, 247, 237); // Orange-50
    doc.setDrawColor(249, 115, 22);  // Orange-500
    doc.roundedRect(10, startY, 190, height, 2, 2, 'FD');

    // Draw Icon (exclamation mark in a circle manually drawn)
    doc.setFillColor(249, 115, 22); // Orange-500
    doc.circle(16, startY + (height / 2), 2.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('!', 16, startY + (height / 2) + 1, { align: 'center' });

    // Text Color & Content
    doc.setTextColor(194, 65, 12); // Orange-700
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);

    splitNotes.forEach((line: string, i: number) => {
      // Offset text by 12mm to make room for icon
      doc.text(line, 22, startY + padding + 3.5 + (i * lineHeight));
    });

    // Reset styles
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');

    return startY + height + 6;
  } else {
    // Normal Notes
    const label = 'Notes :';
    doc.setFont('helvetica', 'bold');
    doc.text(label, 10, startY + 4);

    doc.setFont('helvetica', 'normal');
    const splitNotes = doc.splitTextToSize(cleanNotes, 190);
    splitNotes.forEach((line: string, i: number) => {
      doc.text(line, 10, startY + 9 + (i * 5));
    });

    return startY + 9 + (splitNotes.length * 5) + 4;
  }
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
    // Date avoir
    const dateAvoir = new Date(quoteData.dateDoc).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    doc.text('Date avoir', col1X, startY + 17);
    doc.text(dateAvoir, col1X, startY + 23);

    // Facture d'origine على نفس السطر مع الرقم
    if (quoteData.referenceExterne) {
      const label = 'Facture d\'origine : ';
      const labelWidth = doc.getTextWidth(label);
      const baseY = startY + 30;

      doc.text(label, col1X, baseY);
      doc.setFont('helvetica', 'bold');
      doc.text(quoteData.referenceExterne, col1X + labelWidth, baseY);
      doc.setFont('helvetica', 'normal');
    }
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

  // Delivery Details (Transport, Matricule, Dates)
  if (isDeliveryNote) {
    let deliveryY = startY + 16;
    doc.setFontSize(8);

    if (quoteData.moyenTransport) {
      doc.setFont('helvetica', 'normal');
      doc.text('Transport :', col2X, deliveryY);
      doc.setFont('helvetica', 'bold');
      doc.text(quoteData.moyenTransport, col2X + 18, deliveryY);
      deliveryY += 4;
    }

    if (quoteData.matriculeTransport) {
      doc.setFont('helvetica', 'normal');
      doc.text('Matricule :', col2X, deliveryY);
      doc.setFont('helvetica', 'bold');
      doc.text(quoteData.matriculeTransport, col2X + 18, deliveryY);
      deliveryY += 4;
    }

    if (quoteData.dateLivraisonPrevue) {
      doc.setFont('helvetica', 'normal');
      doc.text('Livraison :', col2X, deliveryY);
      doc.setFont('helvetica', 'bold');
      doc.text(new Date(quoteData.dateLivraisonPrevue).toLocaleDateString('fr-FR'), col2X + 18, deliveryY);
      deliveryY += 4;
    }

    doc.setFontSize(9);
  }

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

// Interface لتخزين مقاطع النص مع التنسيق
interface TextSegment {
  text: string;
  bold: boolean;
}

// Helper function لتحويل HTML إلى مقاطع نصية مع الحفاظ على تنسيق bold
function parseHtmlWithFormatting(html: string): TextSegment[] {
  if (!html) return [];

  const segments: TextSegment[] = [];
  let currentText = '';
  let inBold = false;

  // أولاً: تحويل علامات HTML الخاصة إلى أسطر جديدة
  // معالجة النقاط (bullet points) قبل أي معالجة أخرى
  let processedHtml = html
    // تحويل <li> إلى نقطة قبل أي معالجة أخرى (لضمان ظهور النقاط)
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<ul[^>]*>|<\/ul>|<ol[^>]*>|<\/ol>/gi, '')
    // تحويل <br> و <br/> إلى سطر جديد
    .replace(/<br\s*\/?>/gi, '\n')
    // تحويل <p> و </p> إلى سطر جديد
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    // تحويل <div> و </div> إلى سطر جديد
    .replace(/<div[^>]*>/gi, '\n')
    .replace(/<\/div>/gi, '\n');

  // استخراج النص مع الحفاظ على تنسيق bold من <strong> و <b>
  const tagRegex = /<(strong|b)([^>]*)>|<\/(strong|b)>|([^<]+)/gi;
  let match;
  let lastIndex = 0;

  while ((match = tagRegex.exec(processedHtml)) !== null) {
    // معالجة النص قبل المطابقة
    if (match.index > lastIndex) {
      const beforeText = processedHtml.substring(lastIndex, match.index);
      // إزالة أي علامات HTML متبقية من النص
      const cleanedBeforeText = beforeText.replace(/<[^>]+>/g, '');
      if (cleanedBeforeText.trim()) {
        if (currentText) {
          segments.push({ text: currentText, bold: inBold });
          currentText = '';
        }
        currentText = cleanedBeforeText;
      }
    }

    // معالجة المطابقة
    if (match[1] === 'strong' || match[1] === 'b') {
      // فتح <strong> أو <b>
      if (currentText) {
        segments.push({ text: currentText, bold: inBold });
        currentText = '';
      }
      inBold = true;
    } else if (match[3] === 'strong' || match[3] === 'b') {
      // إغلاق </strong> أو </b>
      if (currentText) {
        segments.push({ text: currentText, bold: inBold });
        currentText = '';
      }
      inBold = false;
    } else if (match[4]) {
      // محتوى نصي - إزالة أي علامات HTML متبقية
      const cleanedText = match[4].replace(/<[^>]+>/g, '');
      if (cleanedText) {
        currentText += cleanedText;
      }
    }

    lastIndex = match.index + match[0].length;
  }

  // معالجة النص المتبقي
  if (lastIndex < processedHtml.length) {
    const remainingText = processedHtml.substring(lastIndex);
    const cleanedText = remainingText.replace(/<[^>]+>/g, '');
    if (cleanedText.trim()) {
      currentText += cleanedText;
    }
  }

  // إضافة المقطع الأخير إن وجد
  if (currentText) {
    segments.push({ text: currentText, bold: inBold });
  }

  // تحويل HTML entities في المقاطع
  return segments
    .map(segment => ({
      ...segment,
      text: segment.text
        .replace(/<[^>]+>/g, '') // إزالة أي علامات HTML متبقية (حماية إضافية)
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    }))
    .filter(segment => segment.text.trim().length > 0); // إزالة المقاطع الفارغة
}

function drawLinesTable(doc: jsPDF, quoteData: QuoteData, startY: number, maxY: number): number {
  // حساب bottom margin بناءً على maxY
  const pageHeight = 297; // ارتفاع A4
  const bottomMargin = pageHeight - maxY; // المسافة من maxY إلى أسفل الصفحة

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

    // نص المنتج بدون HTML (مع تحويلات بسيطة)
    let htmlContent = '';
    if (l.estStocke === false && l.descriptionProduit) {
      htmlContent = l.descriptionProduit;
    } else {
      htmlContent = l.designation || l.produit || l.description || '';
    }
    if (!htmlContent) {
      htmlContent = `Produit ${index + 1}`;
    }

    const plain = htmlContent
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<p[^>]*>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<div[^>]*>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      // أزل علامات القائمة بدون إضافة رموز
      .replace(/<li[^>]*>/gi, '')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();

    return [
      plain,
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
      'Produit',
      'Qté',
      'Prix HT',
      'Remise %',
      'TVA',
      'Total HT',
      'Total TTC'
    ]],
    body,
    // startY يُستخدم للصفحة الأولى فقط، margin.top للصفحات التالية
    margin: { top: 10, left: 10, right: 10, bottom: bottomMargin },
    tableWidth: 190,
    showHead: 'everyPage',
    pageBreak: 'auto',
    rowPageBreak: 'auto',
    styles: {
      fontSize: 9,
      cellPadding: 4,
      valign: 'top',
      halign: 'left',
      minCellHeight: 8,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [232, 241, 255],
      textColor: 0,
      fontStyle: 'bold',
      valign: 'middle',
      halign: 'left',
    },
    alternateRowStyles: {
      fillColor: [252, 252, 252],
    },
    columnStyles: {
      0: { cellWidth: 80, halign: 'left' },  // Produit
      1: { cellWidth: 16, halign: 'center' }, // Qté
      2: { cellWidth: 22, halign: 'right' },  // Prix HT
      3: { cellWidth: 20, halign: 'right' },  // Remise %
      4: { cellWidth: 14, halign: 'right' },  // TVA
      5: { cellWidth: 19, halign: 'right' },  // Total HT
      6: { cellWidth: 19, halign: 'right' },  // Total TTC
    },
  });

  // نرجع آخر Y
  return (doc as any).lastAutoTable.finalY + 6;
}

function drawTotals(doc: jsPDF, quoteData: QuoteData, startY: number, maxHeightBeforeFooter: number): number {
  const x = 125;
  const w = 75;
  const lineH = 6;
  const currencySymbol = quoteData.devise === 'TND' ? ' DT' : ` ${quoteData.devise}`;

  // تحديد نوع المستند
  const docType = quoteData.documentType?.toLowerCase() || '';
  const isDeliveryNote = docType.includes('livraison') || docType.includes('bon de livraison');

  const rows: Array<[string, number | undefined, string?]> = [
    ['Sous-total HT', quoteData.totalBaseHT],
    // عرض remise lignes إذا كان موجوداً
    ...(quoteData.remiseLignes && quoteData.remiseLignes > 0 ? [['Remise lignes', -quoteData.remiseLignes] as [string, number | undefined, string?]] : []),
    // عرض remise globale إذا كان موجوداً (مع النسبة المئوية)
    ...(quoteData.remiseGlobale && quoteData.remiseGlobale > 0 ? [
      [`Remise globale${quoteData.remiseGlobalePct ? ` (${quoteData.remiseGlobalePct}%)` : ''}`, -quoteData.remiseGlobale] as [string, number | undefined, string?]
    ] : []),
    // عرض total remise إذا كان موجوداً (للتوافق مع الإصدارات السابقة)
    ...(quoteData.totalRemise && quoteData.totalRemise > 0 && !quoteData.remiseLignes && !quoteData.remiseGlobale ? [['Total Remise', -quoteData.totalRemise] as [string, number | undefined]] : []),
    ['Total HT', (quoteData.totalBaseHT || 0) - (quoteData.remiseLignes || 0) - (quoteData.remiseGlobale || 0) - (quoteData.totalRemise && !quoteData.remiseLignes && !quoteData.remiseGlobale ? quoteData.totalRemise : 0)],
    // عرض FODEC إذا كان موجوداً
    ...(quoteData.fodec && quoteData.fodec > 0 ? [['FODEC', quoteData.fodec] as [string, number | undefined]] : []),
    ['Total TVA', quoteData.totalTVA],
    // تخطي Timbre fiscal لبطاقات التسليم
    ...(isDeliveryNote ? [] : [['Timbre fiscal', quoteData.timbreFiscal] as [string, number | undefined]]),
  ];

  // حساب ارتفاع الصندوق (فقط للإجماليات، بدون Arrêté و Mode de paiement)
  const validRows = rows.filter(([label, val]) => {
    if (!val && val !== 0) return false;
    if ((label === 'Total Remise' || label === 'Remise lignes' || label.startsWith('Remise globale')) && val === 0) return false;
    if (label === 'Total TVA' && val === 0) return false;
    if (label === 'FODEC' && val === 0) return false;
    // تخطي Timbre fiscal لبطاقات التسليم (يجب ألا يظهر على الإطلاق)
    if (label === 'Timbre fiscal' && isDeliveryNote) return false;
    return true;
  });

  const totalBoxH = 6 + (validRows.length * lineH) + 6 + 7;

  // وضع صندوق الإجماليات فوق التذييل
  // التأكد من أنه لا يتجاوز maxHeightBeforeFooter
  const totalsY = maxHeightBeforeFooter - totalBoxH;
  const actualStartY = Math.min(startY, totalsY);

  // رسم صندوق الإجماليات
  doc.setFillColor(245, 246, 251);
  doc.roundedRect(x, actualStartY, w, totalBoxH, 3, 3, 'F');

  doc.setFontSize(9);
  let y = actualStartY + 6;

  rows.forEach(([label, val]) => {
    // تخطي إذا كان undefined/null
    if (!val && val !== 0) return;
    // تخطي Total Remise, Remise lignes, Remise globale, Total TVA, و FODEC إذا كانت القيمة 0
    if ((label === 'Total Remise' || label === 'Remise lignes' || label.startsWith('Remise globale') || label === 'Total TVA' || label === 'FODEC') && val === 0) return;

    doc.setFont('helvetica', 'normal');
    doc.text(label, x + 4, y);

    // لون خاص للخصم (أحمر إذا كان سالباً)
    if ((label === 'Total Remise' || label === 'Remise lignes' || label.startsWith('Remise globale')) && val && val < 0) {
      doc.setTextColor(255, 0, 0);
    } else {
      doc.setTextColor(0, 0, 0);
    }

    doc.setFont('helvetica', 'bold');
    doc.text(`${Math.abs(val || 0).toFixed(3)}${currencySymbol}`, x + w - 4, y, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    y += lineH;
  });

  // خط فاصل
  doc.setDrawColor(220, 220, 220);
  doc.line(x + 4, y + 1, x + w - 4, y + 1);

  // Total TTC باللون الأزرق
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(47, 95, 255);
  doc.text('Total TTC', x + 4, y + 7);
  doc.text(`${quoteData.totalTTC.toFixed(3)}${currencySymbol}`, x + w - 4, y + 7, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  // Arrêté à la somme de (خارج الصندوق، أسفله)
  // التأكد من عدم تجاوز منطقة التذييل
  const boxBottomY = actualStartY + totalBoxH;
  const currencyName = quoteData.devise === 'TND' ? 'Dinars tunisiens' : quoteData.devise;
  const amountInWords = amountToWordsFr(quoteData.totalTTC, currencyName);
  const maxWidth = 190; // عرض الصفحة الكامل ناقص الهوامش (200 - 10)
  const splitText = doc.splitTextToSize(`Arrêté à la somme de : ${amountInWords}`, maxWidth);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(102, 102, 102);

  // التأكد من أن Arrêté لا يتجاوز منطقة التذييل
  const arrêtéStartY = boxBottomY + 5;
  if (arrêtéStartY + (splitText.length * 4) < maxHeightBeforeFooter - 10) {
    splitText.forEach((line: string, idx: number) => {
      doc.text(line, 10, arrêtéStartY + (idx * 4));
    });
  }

  // Mode de paiement (خارج الصندوق، أسفل Arrêté)
  // التأكد من عدم تجاوز منطقة التذييل
  const arrêtéEndY = arrêtéStartY + (splitText.length * 4);
  const modePaiementY = arrêtéEndY + 3;
  if (quoteData.modePaiement && modePaiementY < maxHeightBeforeFooter - 5) {
    doc.text(`Mode de paiement : ${quoteData.modePaiement}`, 10, modePaiementY);
  }
  doc.setTextColor(0, 0, 0);

  return Math.max(boxBottomY, modePaiementY + 5);
}

function drawFooter(doc: jsPDF, companyInfo: CompanyInfo, footerY: number, pageNumber?: number, totalPages?: number): void {
  // التأكد من أن التذييل يُرسم في موضع آمن (لا يتداخل مع المحتوى)
  // footerY = 280 هو الموضع الثابت للتذييل
  const pageHeight = 297; // ارتفاع صفحة A4
  const safeFooterY = Math.min(footerY, pageHeight - 15); // التأكد من عدم تجاوز الصفحة

  // رسم خط أفقي في موضع ثابت
  doc.setDrawColor(220, 220, 220);
  doc.line(10, safeFooterY, 200, safeFooterY);

  const yPos = safeFooterY + 6;
  doc.setFontSize(9).setTextColor(0, 0, 0);

  // بناء عناصر التذييل
  const footerItems: string[] = [];

  // العنوان
  const addressParts = [
    companyInfo.adresse.rue,
    companyInfo.adresse.ville,
    companyInfo.adresse.codePostal,
    companyInfo.adresse.pays
  ].filter(Boolean);
  if (addressParts.length > 0) {
    footerItems.push(addressParts.join(', '));
  }

  // الهاتف
  if (companyInfo.enTete?.telephone) {
    footerItems.push(`Tél : ${companyInfo.enTete.telephone}`);
  }

  // رأس المال
  if (companyInfo.enTete?.capitalSocial) {
    footerItems.push(`Capital social : ${companyInfo.enTete.capitalSocial}`);
  }

  // البنك + RIB (على نفس السطر)
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

  // دمج جميع العناصر مع " - " وتوسيطها
  if (footerItems.length > 0) {
    const footerText = footerItems.join(' - ');
    const centerX = 105; // مركز صفحة A4 (210mm / 2)
    doc.text(footerText, centerX, yPos, { align: 'center' });
  }

  // إضافة رقم الصفحة إذا تم توفيره - تحسين الترقيم
  if (pageNumber !== undefined && totalPages !== undefined) {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    const pageText = `${pageNumber} / ${totalPages}`;
    // وضع الترقيم في الزاوية اليمنى السفلى مع هامش مناسب
    doc.text(pageText, 200 - 10, safeFooterY - 3, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }
}

export function generateDevisPdf(quoteData: QuoteData, companyInfo: CompanyInfo): jsPDF {
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4',
    compress: true
  });
  const pageHeight = 297; // ارتفاع A4 بالمليمتر
  const footerY = 280; // موضع ثابت للتذييل عند 280mm من الأعلى
  const topMargin = 10; // هامش علوي
  const footerHeight = 20; // ارتفاع منطقة التذييل (خط + نص)
  const maxContentY = footerY - footerHeight; // الحد الأقصى للمحتوى (260mm)

  // رسم الهيدر والعنوان وكتل المعلومات
  let y = drawHeader(doc, companyInfo);
  y = drawDevisTitle(doc, quoteData.documentType);
  y = drawInfoBlocks(doc, quoteData, companyInfo, y);

  // Draw Notes (Alerts/Warnings) before table
  y = drawNotes(doc, quoteData.notes, y);

  // رسم الجدول مع تحديد الحد الأقصى للمحتوى
  const tableEndY = drawLinesTable(doc, quoteData, y, maxContentY);

  // الحصول على موضع الجدول الفعلي بعد الرسم
  const finalPageCount = doc.getNumberOfPages();
  doc.setPage(finalPageCount);
  const currentPageY = (doc as any).lastAutoTable?.finalY || tableEndY;

  // حساب ارتفاع صندوق الإجماليات
  const currencyName = quoteData.devise === 'TND' ? 'Dinars tunisiens' : quoteData.devise;
  const amountInWords = amountToWordsFr(quoteData.totalTTC, currencyName);
  const splitText = doc.splitTextToSize(`Arrêté à la somme de : ${amountInWords}`, 190);

  // حساب عدد الصفوف الفعلية في صندوق الإجماليات
  const rows: Array<[string, number | undefined]> = [
    ['Sous-total HT', quoteData.totalBaseHT],
    ...(quoteData.remiseLignes && quoteData.remiseLignes > 0 ? [['Remise lignes', -quoteData.remiseLignes] as [string, number | undefined]] : []),
    ...(quoteData.remiseGlobale && quoteData.remiseGlobale > 0 ? [[`Remise globale${quoteData.remiseGlobalePct ? ` (${quoteData.remiseGlobalePct}%)` : ''}`, -quoteData.remiseGlobale] as [string, number | undefined]] : []),
    ...(quoteData.totalRemise && quoteData.totalRemise > 0 && !quoteData.remiseLignes && !quoteData.remiseGlobale ? [['Total Remise', -quoteData.totalRemise] as [string, number | undefined]] : []),
    ['Total HT', (quoteData.totalBaseHT || 0) - (quoteData.remiseLignes || 0) - (quoteData.remiseGlobale || 0) - (quoteData.totalRemise && !quoteData.remiseLignes && !quoteData.remiseGlobale ? quoteData.totalRemise : 0)],
    ...(quoteData.fodec && quoteData.fodec > 0 ? [['FODEC', quoteData.fodec] as [string, number | undefined]] : []),
    ['Total TVA', quoteData.totalTVA],
    ...(quoteData.documentType?.toLowerCase().includes('livraison') ? [] : [['Timbre fiscal', quoteData.timbreFiscal] as [string, number | undefined]]),
  ];

  const validRows = rows.filter(([label, val]) => {
    if (!val && val !== 0) return false;
    if ((label === 'Total Remise' || label === 'Remise lignes' || label.startsWith('Remise globale')) && val === 0) return false;
    if (label === 'Total TVA' && val === 0) return false;
    if (label === 'FODEC' && val === 0) return false;
    if (label === 'Timbre fiscal' && quoteData.documentType?.toLowerCase().includes('livraison')) return false;
    return true;
  });

  const totalBoxH = 6 + (validRows.length * 6) + 6 + 7;
  const arrêtéHeight = splitText.length * 4 + 5;
  const modePaiementHeight = quoteData.modePaiement ? 7 : 0;
  const totalNeededHeight = totalBoxH + arrêtéHeight + modePaiementHeight + 5;

  // التأكد من أن الجدول لم يتجاوز الحد الأقصى
  const safeCurrentPageY = Math.min(currentPageY, maxContentY);
  const availableSpace = maxContentY - safeCurrentPageY;

  // رسم الإجماليات
  if (availableSpace >= totalNeededHeight) {
    // توجد مساحة كافية على الصفحة الأخيرة
    const finalY = drawTotals(doc, quoteData, safeCurrentPageY + 5, maxContentY);
    // Draw Stamp if available
    if (companyInfo.cachetUrl) {
      // Position stamp to the LEFT of the totals box
      // Totals box starts at x=125. We place stamp at x=80 roughly.
      // We align it vertically with the "Arrêté à la somme de" or slightly higher.
      drawStamp(doc, companyInfo.cachetUrl, 80, finalY - 40, 40, 40);
    }
  } else {
    // لا توجد مساحة كافية، إضافة صفحة جديدة
    doc.addPage();
    const finalY = drawTotals(doc, quoteData, topMargin, maxContentY);
    if (companyInfo.cachetUrl) {
      drawStamp(doc, companyInfo.cachetUrl, 80, finalY - 40, 40, 40);
    }
  }

  // تحديث عدد الصفحات النهائي
  const totalPages = doc.getNumberOfPages();

  // رسم التذييل على جميع الصفحات
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(doc, companyInfo, footerY, i, totalPages);
  }

  // Add watermark for internal invoices with BROUILLON or ANNULEE status
  if (quoteData.statut === 'BROUILLON' || quoteData.statut === 'ANNULEE') {
    try {
      const finalPageCount = doc.getNumberOfPages();
      const watermarkText = quoteData.statut === 'BROUILLON' ? 'BROUILLON' : 'ANNULEE';

      console.log('[PDF Watermark] Adding watermark:', watermarkText, 'statut:', quoteData.statut, 'on', finalPageCount, 'pages');

      // Add watermark on all pages
      for (let i = 1; i <= finalPageCount; i++) {
        doc.setPage(i);

        // Save current graphics state
        const currentTextColor = doc.getTextColor();
        const currentFont = doc.getFont();
        const currentFontSize = doc.getFontSize();

        // Get page dimensions (in mm for A4)
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // Set watermark properties: bold, large, 30% opacity
        doc.setFontSize(72); // Large font size
        doc.setFont('helvetica', 'bold');

        // Set text color with 30% opacity (RGB with alpha)
        // jsPDF doesn't support alpha directly, so we use a light gray color
        // 30% opacity = 70% transparency = light gray (approximately RGB(180, 180, 180))
        doc.setTextColor(180, 180, 180);

        // Calculate text dimensions to center it
        const textWidth = doc.getTextWidth(watermarkText);

        // Center the watermark on the page
        const centerX = pageWidth / 2;
        const centerY = pageHeight / 2;

        // Simple approach: draw text directly in center (without rotation for now)
        // This ensures the watermark appears even if rotation fails
        try {
          doc.text(watermarkText, centerX, centerY, {
            align: 'center',
            baseline: 'middle'
          });
        } catch (textError) {
          console.error('[PDF Watermark] Error drawing text:', textError);
          // Continue even if text drawing fails
        }

        // Restore original graphics state
        // getTextColor() returns a string like "rgb(0,0,0)" or array [r,g,b]
        if (typeof currentTextColor === 'string') {
          // Parse RGB string like "rgb(0,0,0)" or "#000000"
          const rgbMatch = currentTextColor.match(/\d+/g);
          if (rgbMatch && rgbMatch.length >= 3) {
            doc.setTextColor(parseInt(rgbMatch[0]), parseInt(rgbMatch[1]), parseInt(rgbMatch[2]));
          } else {
            doc.setTextColor(0, 0, 0); // Default to black
          }
        } else if (Array.isArray(currentTextColor)) {
          const colorArray = currentTextColor as number[];
          if (colorArray.length >= 3) {
            doc.setTextColor(colorArray[0], colorArray[1], colorArray[2]);
          } else {
            doc.setTextColor(0, 0, 0); // Default to black
          }
        } else {
          doc.setTextColor(0, 0, 0); // Default to black
        }
        doc.setFont(currentFont.fontName, currentFont.fontStyle);
        doc.setFontSize(currentFontSize);
      }

      console.log('[PDF Watermark] Watermark added successfully');
    } catch (watermarkError: any) {
      console.error('[PDF Watermark] Error adding watermark:', watermarkError);
      // Don't fail PDF generation if watermark fails
    }
  }

  return doc;
}
