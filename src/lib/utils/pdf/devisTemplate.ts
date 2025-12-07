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
function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  
  const entityMap: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    Agrave: 'À',
    Aacute: 'Á',
    Acirc: 'Â',
    Atilde: 'Ã',
    Auml: 'Ä',
    Aring: 'Å',
    AElig: 'Æ',
    Ccedil: 'Ç',
    Egrave: 'È',
    Eacute: 'É',
    Ecirc: 'Ê',
    Euml: 'Ë',
    Igrave: 'Ì',
    Iacute: 'Í',
    Icirc: 'Î',
    Iuml: 'Ï',
    ETH: 'Ð',
    Ntilde: 'Ñ',
    Ograve: 'Ò',
    Oacute: 'Ó',
    Ocirc: 'Ô',
    Otilde: 'Õ',
    Ouml: 'Ö',
    Oslash: 'Ø',
    Ugrave: 'Ù',
    Uacute: 'Ú',
    Ucirc: 'Û',
    Uuml: 'Ü',
    Yacute: 'Ý',
    THORN: 'Þ',
    szlig: 'ß',
    agrave: 'à',
    aacute: 'á',
    acirc: 'â',
    atilde: 'ã',
    auml: 'ä',
    aring: 'å',
    aelig: 'æ',
    ccedil: 'ç',
    egrave: 'è',
    eacute: 'é',
    ecirc: 'ê',
    euml: 'ë',
    igrave: 'ì',
    iacute: 'í',
    icirc: 'î',
    iuml: 'ï',
    eth: 'ð',
    ntilde: 'ñ',
    ograve: 'ò',
    oacute: 'ó',
    ocirc: 'ô',
    otilde: 'õ',
    ouml: 'ö',
    oslash: 'ø',
    ugrave: 'ù',
    uacute: 'ú',
    ucirc: 'û',
    uuml: 'ü',
    yacute: 'ý',
    thorn: 'þ',
    yuml: 'ÿ'
  };

  return text
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&([a-zA-Z]+);/g, (_, name) => entityMap[name] || `&${name};`);
}

// Parse HTML and convert to jsPDF-compatible format with styling
function parseHtmlToPdf(html: string): any {
  if (!html) return { text: '', styles: [] };
  
  // Convert <br> to newlines
  let text = html.replace(/<br\s*\/?>/gi, '\n');
  
  // Extract styled segments
  const segments: Array<{ text: string; bold?: boolean; color?: number[] }> = [];
  let currentText = '';
  let currentBold = false;
  let currentColor: number[] | undefined = undefined;
  
  // Simple HTML parser for common tags
  const tagRegex = /<(?:strong|b|span[^>]*|font[^>]*)>(.*?)<\/(?:strong|b|span|font)>|([^<]+)/gi;
  let match;
  let lastIndex = 0;
  
  // Process HTML tags
  const tempDiv = typeof document !== 'undefined' ? document.createElement('div') : null;
  if (tempDiv) {
    tempDiv.innerHTML = html;
    const walker = document.createTreeWalker(
      tempDiv,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      null
    );
    
    let node;
    while (node = walker.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        if (text.trim()) {
          // Check parent for styling
          let parent = node.parentElement;
          let isBold = false;
          let color: number[] | undefined = undefined;
          
          while (parent && parent !== tempDiv) {
            const tagName = parent.tagName.toLowerCase();
            if (tagName === 'strong' || tagName === 'b') {
              isBold = true;
            }
            if (parent.style && parent.style.color) {
              const rgb = parseColor(parent.style.color);
              if (rgb) color = rgb;
            }
            parent = parent.parentElement;
          }
          
          segments.push({ text, bold: isBold, color });
        }
      }
    }
  } else {
    // Fallback: simple text extraction with basic formatting
    text = html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<strong[^>]*>|<\/strong>|<b[^>]*>|<\/b>/gi, '***BOLD_START***')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n\s*\n/g, '\n')
      .trim();
    
    // Split by bold markers
    const parts = text.split('***BOLD_START***');
    parts.forEach((part, index) => {
      if (part.trim()) {
        segments.push({ 
          text: part, 
          bold: index % 2 === 1 
        });
      }
    });
  }
  
  if (segments.length === 0) {
    // Fallback to plain text
    text = html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n\s*\n/g, '\n')
      .trim();
    segments.push({ text });
  }
  
  return { segments, rawText: segments.map(s => s.text).join('') };
}

function parseColor(colorStr: string): number[] | undefined {
  if (!colorStr) return undefined;
  
  // Parse CSS color to RGB array
  const trimmed = colorStr.trim();
  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1);
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return [r, g, b];
    } else if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return [r, g, b];
    }
  }
  if (trimmed.startsWith('rgb')) {
    const matches = trimmed.match(/\d+/g);
    if (matches && matches.length >= 3) {
      return [parseInt(matches[0]), parseInt(matches[1]), parseInt(matches[2])];
    }
  }
  // Named colors
  const namedColors: { [key: string]: number[] } = {
    'black': [0, 0, 0],
    'white': [255, 255, 255],
    'red': [255, 0, 0],
    'green': [0, 128, 0],
    'blue': [0, 0, 255],
    'yellow': [255, 255, 0],
    'orange': [255, 165, 0],
    'purple': [128, 0, 128],
  };
  const lower = trimmed.toLowerCase();
  if (namedColors[lower]) {
    return namedColors[lower];
  }
  return undefined;
}

function renderText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight: number, bold: boolean, color?: number[]) {
  if (!text || !text.trim()) return;
  
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  if (color) {
    doc.setTextColor(color[0], color[1], color[2]);
  } else {
    doc.setTextColor(0, 0, 0);
  }
  
  // Split text into lines that fit within maxWidth
  const words = text.split(/\s+/);
  let currentLine = '';
  let currentY = y;
  
  words.forEach((word) => {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const textWidth = doc.getTextWidth(testLine);
    
    if (textWidth > maxWidth && currentLine) {
      // Draw current line and start new line
      doc.text(currentLine, x, currentY, { maxWidth });
      currentLine = word;
      currentY += lineHeight;
    } else {
      currentLine = testLine;
    }
  });
  
  if (currentLine) {
    doc.text(currentLine, x, currentY, { maxWidth });
  }
}

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
  
  text = decodeHtmlEntities(text);
  text = text.replace(/&(?![a-zA-Z]+;|#[0-9]+;|#x[0-9a-f]+;)/g, ' ');
  
  text = text.replace(/\\n/g, '***LINE_BREAK***');
  
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
    
    // Get the HTML content (same logic as web app)
    let htmlContent = '';
    if (l.estStocke === false && l.descriptionProduit) {
      htmlContent = l.descriptionProduit;
    } else {
      htmlContent = l.designation || l.produit || l.description || '';
    }
    if (!htmlContent) {
      htmlContent = `Produit ${index + 1}`;
    }

    return [
      { content: htmlContent, isHtml: true },
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
      cellPadding: { top: 4, right: 3, bottom: 3, left: 3 },
      valign: 'top',
      halign: 'left',
      minCellHeight: 8,
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
    // نقسم الـ 190 على الكولونات
    columnStyles: {
      0: { cellWidth: 88, cellPadding: { top: 4, right: 3, bottom: 3, left: 3 }, valign: 'top', halign: 'left' }, // Produit
      1: { cellWidth: 12, halign: 'right', valign: 'top' }, // Qté
      2: { cellWidth: 22, halign: 'right', valign: 'top' }, // Prix HT
      3: { cellWidth: 16, halign: 'right', valign: 'top' }, // Remise %
      4: { cellWidth: 14, halign: 'right', valign: 'top' }, // TVA
      5: { cellWidth: 19, halign: 'right', valign: 'top' }, // Total HT
      6: { cellWidth: 19, halign: 'right', valign: 'top' }, // Total TTC
    },
    willDrawCell: (data: any) => {
      // Ensure all cells in the row have the same height as the tallest cell
      if (data.row && data.row.height) {
        data.cell.height = data.row.height;
      }
    },
    didParseCell: (data: any) => {
      // Handle HTML content in Produit column (column index 1)
      if (data.column.index === 0 && data.cell.raw && typeof data.cell.raw === 'object' && data.cell.raw.isHtml) {
        const html = data.cell.raw.content || '';
        // Store HTML for custom rendering
        (data.cell as any).htmlContent = html;
        
        // Calculate approximate height needed for content (including word wrapping)
        const htmlText = html
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<p[^>]*>/gi, '\n')
          .replace(/<\/p>/gi, '\n')
          .replace(/<div[^>]*>/gi, '\n')
          .replace(/<\/div>/gi, '\n')
          .replace(/<[^>]*>/g, '');
        
        // Estimate lines considering word wrapping
        const lines = htmlText.split('\n');
        const maxWidth = 70 - 4; // Approximate cell width minus padding
        const fontSize = 9;
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', 'normal');
        
        let totalEstimatedLines = 0;
        lines.forEach((line) => {
          if (line.trim()) {
            const textWidth = doc.getTextWidth(line);
            const wrappedLines = Math.ceil(textWidth / maxWidth) || 1;
            totalEstimatedLines += wrappedLines;
          } else {
            totalEstimatedLines += 0.5; // Small spacing for empty lines
          }
        });
        
        const lineHeight = 4.5;
        const minHeight = 8;
        // Calculate height more accurately - don't add extra padding
        // The height should be: (lines * lineHeight) + paddingTop + paddingBottom
        const paddingTop = 4;
        const paddingBottom = 3;
        const calculatedHeight = Math.max(minHeight, (totalEstimatedLines * lineHeight) + paddingTop + paddingBottom);
        
        // Set cell height to accommodate content
        data.cell.height = calculatedHeight;
        
        // Set row height to match the tallest cell (so all cells in the row have same height)
        if (data.row) {
          data.row.height = Math.max(data.row.height || 0, calculatedHeight);
        }
        
        // Set empty text to prevent default rendering - use space to maintain cell height
        data.cell.text = [' '];
        // Disable default text rendering
        data.cell.styles = { ...data.cell.styles, textColor: [255, 255, 255] }; // White text (invisible)
      }
    },
    didDrawCell: (data: any) => {
      // Custom rendering for HTML content in Produit column
      if (data.column.index === 0 && (data.cell as any).htmlContent) {
        const html = (data.cell as any).htmlContent;
        const cell = data.cell;
        // Get padding from cell styles (matches columnStyles: left: 3, top: 4)
        const paddingLeft = (cell.styles?.cellPadding?.left || cell.styles?.cellPadding?.[0] || 3);
        const paddingTop = (cell.styles?.cellPadding?.top || cell.styles?.cellPadding?.[1] || 4);
        const paddingRight = (cell.styles?.cellPadding?.right || cell.styles?.cellPadding?.[2] || 3);
        
        // cell.x and cell.y are the top-left corner of the cell
        // autoTable calculates text position based on valign and padding
        // For valign: 'top', autoTable positions text at: cell.y + paddingTop
        // jsPDF uses 'alphabetic' baseline, so we need to account for that
        const fontSize = 9;
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', 'normal');
        
        // Calculate x and y positions to match autoTable's text positioning exactly
        // autoTable positions text for valign: 'top' 
        const x = cell.x + paddingLeft;
        
        // For valign: 'top', autoTable positions text baseline
        // Try using the cell's text position if available (most accurate)
        let y = (cell as any).textPos?.y;
        const fontAscent = 2.5; // Very small offset for baseline adjustment
        if (!y) {
          // Fallback: use cell.y + paddingTop with minimal offset
          // This should align better with autoTable's default text positioning
          y = cell.y + paddingTop + fontAscent;
        }
        const maxWidth = cell.width - paddingLeft - paddingRight;
        const lineHeight = 4.5;
        const startY = y;
        
        // Parse HTML and render with formatting
        // Convert HTML tags to newlines first
        let htmlText = html
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<p[^>]*>/gi, '\n')
          .replace(/<\/p>/gi, '\n')
          .replace(/<div[^>]*>/gi, '\n')
          .replace(/<\/div>/gi, '\n')
          .replace(/<li[^>]*>/gi, '• ')
          .replace(/<\/li>/gi, '\n')
          .replace(/<ul[^>]*>|<\/ul>|<ol[^>]*>|<\/ol>/gi, '');
        
        // Process HTML with a simple state machine
        const segments: Array<{ text: string; bold: boolean; color?: number[] }> = [];
        let currentText = '';
        let inBold = false;
        let currentColor: number[] | undefined = undefined;
        
        // Simple regex-based parser - handles <font color="...">, <span style="color:...">, <strong>, <b>
        const tagRegex = /<(?:strong|b)([^>]*)>|<\/(?:strong|b)>|<font[^>]*color\s*=\s*["']([^"']+)["'][^>]*>|<\/font>|<span[^>]*style\s*=\s*["'][^"]*color\s*:\s*([^";\s]+)[^"]*["'][^>]*>|<\/span>|([^<]+)/gi;
        let match;
        let lastIndex = 0;
        
        while ((match = tagRegex.exec(htmlText)) !== null) {
          // Handle text before match
          if (match.index > lastIndex) {
            const beforeText = htmlText.substring(lastIndex, match.index);
            if (beforeText.trim()) {
              segments.push({ text: beforeText, bold: inBold, color: currentColor });
            }
          }
          
          // Handle match
          if (match[1] !== undefined) {
            // Opening <strong> or <b>
            if (currentText) {
              segments.push({ text: currentText, bold: inBold, color: currentColor });
              currentText = '';
            }
            inBold = true;
          } else if (match[0] === '</strong>' || match[0] === '</b>') {
            // Closing </strong> or </b>
            if (currentText) {
              segments.push({ text: currentText, bold: inBold, color: currentColor });
              currentText = '';
            }
            inBold = false;
          } else if (match[2] !== undefined) {
            // Opening <font color="...">
            if (currentText) {
              segments.push({ text: currentText, bold: inBold, color: currentColor });
              currentText = '';
            }
            currentColor = parseColor(match[2]);
          } else if (match[0] === '</font>' || match[0] === '/font>') {
            // Closing </font> or /font> (handle malformed HTML)
            if (currentText) {
              segments.push({ text: currentText, bold: inBold, color: currentColor });
              currentText = '';
            }
            currentColor = undefined;
          } else if (match[3] !== undefined) {
            // Opening <span> with color in style
            if (currentText) {
              segments.push({ text: currentText, bold: inBold, color: currentColor });
              currentText = '';
            }
            currentColor = parseColor(match[3]);
          } else if (match[0] === '</span>') {
            // Closing </span>
            if (currentText) {
              segments.push({ text: currentText, bold: inBold, color: currentColor });
              currentText = '';
            }
            currentColor = undefined;
          } else if (match[4]) {
            // Text content
            currentText += match[4];
          }
          
          lastIndex = match.index + match[0].length;
        }
        
        // Handle remaining text
        if (lastIndex < htmlText.length) {
          const remainingText = htmlText.substring(lastIndex);
          if (remainingText.trim()) {
            segments.push({ text: remainingText, bold: inBold, color: currentColor });
          }
        }
        if (currentText) {
          segments.push({ text: currentText, bold: inBold, color: currentColor });
        }
        
        // Render segments and count actual lines rendered
        // Note: jsPDF uses 'alphabetic' baseline by default, but we adjust y position
        // to account for the font's ascender to align with autoTable's top alignment
        let totalLinesRendered = 0;
        segments.forEach((segment) => {
          const lines = segment.text.split('\n');
          lines.forEach((line, lineIdx) => {
            if (line.trim() || (lineIdx === 0 && lines.length === 1)) {
              doc.setFont('helvetica', segment.bold ? 'bold' : 'normal');
              if (segment.color) {
                doc.setTextColor(segment.color[0], segment.color[1], segment.color[2]);
              } else {
                doc.setTextColor(0, 0, 0);
              }
              
              // Wrap long lines and count wrapped lines
              const words = line.split(/\s+/);
              let currentLine = '';
              
              words.forEach((word) => {
                const testLine = currentLine ? `${currentLine} ${word}` : word;
                const textWidth = doc.getTextWidth(testLine);
                
                if (textWidth > maxWidth && currentLine) {
                  // Use options to ensure left alignment
                  doc.text(currentLine, x, y, { maxWidth, align: 'left' });
                  y += lineHeight;
                  totalLinesRendered++;
                  currentLine = word;
                } else {
                  currentLine = testLine;
                }
              });
              
              if (currentLine) {
                doc.text(currentLine, x, y, { maxWidth, align: 'left' });
                y += lineHeight;
                totalLinesRendered++;
              }
            } else if (lineIdx > 0) {
              y += lineHeight / 2; // Small spacing for empty lines
              totalLinesRendered += 0.5;
            }
          });
        });
        
        // Calculate actual height needed based on content rendered
        // Include top and bottom padding in the height calculation
        const paddingBottom = (cell.styles?.cellPadding?.bottom || cell.styles?.cellPadding?.[3] || 3);
        
        // Calculate the actual height based on the content rendered
        // The y position started at startY (which is cell.y + paddingTop + fontAscent)
        // The content ends at: y (current position after rendering)
        // The content height is: (y - startY) which gives us the height of all rendered lines
        // We need to add fontAscent for the last line's baseline, and paddingBottom
        // paddingTop is already included in startY, so we don't add it again
        const contentHeight = (y - startY) + fontAscent;
        // The actual cell height: contentHeight + paddingBottom (paddingTop already in startY)
        const actualHeight = contentHeight + paddingBottom;
        const minCellHeight = (cell.styles?.minCellHeight || 8);
        // Use the calculated height, ensuring it's at least minCellHeight
        const finalHeight = Math.max(actualHeight, minCellHeight);
        
        // Update cell height to match actual content
        cell.height = finalHeight;
        
        // Update row height to match - this ensures all cells in the row have the same height
        if (data.row) {
          data.row.height = Math.max(data.row.height || 0, finalHeight);
        }
        
        // Reset text color and font
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
      }
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

  const rows: Array<[string, number | undefined, string?]> = [
    ['Sous-total HT', quoteData.totalBaseHT],
    // Show remise lignes if exists
    ...(quoteData.remiseLignes && quoteData.remiseLignes > 0 ? [['Remise lignes', -quoteData.remiseLignes] as [string, number | undefined, string?]] : []),
    // Show remise globale if exists (with percentage)
    ...(quoteData.remiseGlobale && quoteData.remiseGlobale > 0 ? [
      [`Remise globale${quoteData.remiseGlobalePct ? ` (${quoteData.remiseGlobalePct}%)` : ''}`, -quoteData.remiseGlobale] as [string, number | undefined, string?]
    ] : []),
    // Show total remise if exists (for backward compatibility)
    ...(quoteData.totalRemise && quoteData.totalRemise > 0 && !quoteData.remiseLignes && !quoteData.remiseGlobale ? [['Total Remise', -quoteData.totalRemise] as [string, number | undefined]] : []),
    ['Total HT', (quoteData.totalBaseHT || 0) - (quoteData.remiseLignes || 0) - (quoteData.remiseGlobale || 0) - (quoteData.totalRemise && !quoteData.remiseLignes && !quoteData.remiseGlobale ? quoteData.totalRemise : 0)],
    // Show FODEC if exists
    ...(quoteData.fodec && quoteData.fodec > 0 ? [['FODEC', quoteData.fodec] as [string, number | undefined]] : []),
    ['Total TVA', quoteData.totalTVA],
    // Skip Timbre fiscal for delivery notes
    ...(isDeliveryNote ? [] : [['Timbre fiscal', quoteData.timbreFiscal] as [string, number | undefined]]),
  ];

  // Calculate box height (only for totals, without Arrêté and Mode de paiement)
  const validRows = rows.filter(([label, val]) => {
    if (!val && val !== 0) return false;
    if ((label === 'Total Remise' || label === 'Remise lignes' || label.startsWith('Remise globale')) && val === 0) return false;
    if (label === 'Total TVA' && val === 0) return false;
    if (label === 'FODEC' && val === 0) return false;
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
    // Skip Total Remise, Remise lignes, Remise globale, Total TVA, and FODEC if value is 0
    if ((label === 'Total Remise' || label === 'Remise lignes' || label.startsWith('Remise globale') || label === 'Total TVA' || label === 'FODEC') && val === 0) return;

    doc.setFont('helvetica', 'normal');
    doc.text(label, x + 4, y);
    
    // Special color for remise (red if negative)
    if ((label === 'Total Remise' || label === 'Remise lignes' || label.startsWith('Remise globale')) && val && val < 0) {
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
