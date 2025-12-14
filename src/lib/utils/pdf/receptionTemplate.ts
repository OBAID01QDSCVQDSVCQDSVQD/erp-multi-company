import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReceptionLine {
  reference?: string;
  designation?: string;
  qteCommandee?: number;
  qteRecue: number;
  unite?: string;
  prixUnitaireHT?: number;
  remisePct?: number;
  tvaPct?: number;
  totalLigneHT?: number;
}

interface ReceptionData {
  numero: string;
  dateDoc: string;
  documentType: string;
  supplierName?: string;
  supplierAddress?: string;
  supplierMatricule?: string;
  supplierPhone?: string;
  devise: string;
  lignes: ReceptionLine[];
  totalHT: number;
  fodec?: number;
  totalTVA: number;
  timbre?: number;
  totalTTC: number;
  fodecActif?: boolean;
  tauxFodec?: number;
  timbreActif?: boolean;
  montantTimbre?: number;
  remiseGlobalePct?: number;
  notes?: string;
  statut: string;
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

    const format = base64.split(',')[0].split('/')[1].split(';')[0].toUpperCase();
    doc.addImage(base64, format, x, y, w, h);
    
    return y + h;
  } catch (error) {
    console.error('Error adding logo:', error);
    return y + maxH;
  }
}

function drawHeader(doc: jsPDF, companyInfo: CompanyInfo): number {
  doc.setFillColor(244, 246, 251);
  doc.roundedRect(10, 10, 190, 32, 4, 4, 'F');

  const bottomLogo = drawLogo(doc, companyInfo.logoUrl, 15, 13, 45, 22);

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

function drawReceptionTitle(doc: jsPDF): number {
  const startY = 10 + 32 + 8;
  
  doc.setFontSize(16).setFont('helvetica', 'bold');
  doc.setTextColor(47, 95, 255);
  doc.text('Bon de réception', 10, startY);
  doc.setTextColor(0, 0, 0);
  
  return startY + 8;
}

function drawInfoBlocks(doc: jsPDF, receptionData: ReceptionData, companyInfo: CompanyInfo, startY: number): number {
  const col1X = 12;
  const col2X = 75;
  const supplierX = 120;
  const h = 28;

  doc.setFontSize(9).setFont('helvetica', 'normal');
  doc.text('Numéro de réception', col1X, startY + 4);
  doc.setTextColor(47, 95, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(receptionData.numero, col1X, startY + 10);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');

  // Date
  doc.text('Date', col2X, startY + 4);
  doc.setFont('helvetica', 'bold');
  doc.text(new Date(receptionData.dateDoc).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }), col2X, startY + 10);
  doc.setFont('helvetica', 'normal');

  // Statut
  doc.text('Statut', col1X, startY + 17);
  doc.setFont('helvetica', 'bold');
  const statutText = receptionData.statut === 'VALIDE' ? 'Validé' : receptionData.statut === 'ANNULE' ? 'Annulé' : 'Brouillon';
  doc.text(statutText, col1X, startY + 23);

  // Bloc fournisseur
  let textY = startY + 12;
  let dynamicHeight = 6;
  
  let addressLines = 0;
  if (receptionData.supplierAddress) {
    const addressText = `Adresse: ${receptionData.supplierAddress}`;
    const addressWidth = 72;
    const splitAddress = doc.splitTextToSize(addressText, addressWidth);
    addressLines = splitAddress.length;
    dynamicHeight += 5 + (addressLines * 4);
  } else {
    dynamicHeight += 5;
  }
  
  if (receptionData.supplierPhone) {
    dynamicHeight += 5;
  }
  
  dynamicHeight = Math.max(dynamicHeight, h);
  
  doc.setFillColor(238, 244, 255);
  doc.roundedRect(supplierX, startY, 80, dynamicHeight, 3, 3, 'F');
  
  doc.setFontSize(9).setFont('helvetica', 'bold');
  doc.text('Fournisseur', supplierX + 4, startY + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(receptionData.supplierName || '—', supplierX + 4, textY);
  textY += 5;
  
  if (receptionData.supplierAddress) {
    const addressText = `Adresse: ${receptionData.supplierAddress}`;
    const addressWidth = 72;
    const splitAddress = doc.splitTextToSize(addressText, addressWidth);
    splitAddress.forEach((line: string, idx: number) => {
      doc.text(line, supplierX + 4, textY + (idx * 4));
    });
    textY += splitAddress.length * 4;
  }
  
  if (receptionData.supplierPhone) {
    doc.text(`Tél: ${receptionData.supplierPhone}`, supplierX + 4, textY);
  }

  return startY + dynamicHeight + 6;
}

function drawLinesTable(doc: jsPDF, receptionData: ReceptionData, startY: number): number {
  const body = receptionData.lignes.map((l) => {
    return [
      l.reference || '—',
      l.designation || '—',
      l.qteCommandee ? l.qteCommandee.toString() : '—',
      l.qteRecue.toString(),
      l.unite || 'PCE',
      l.prixUnitaireHT ? l.prixUnitaireHT.toFixed(3) : '—',
      l.remisePct !== undefined && l.remisePct !== null && l.remisePct > 0 ? `${l.remisePct} %` : '—',
      l.tvaPct ? `${l.tvaPct} %` : '—',
      l.totalLigneHT ? l.totalLigneHT.toFixed(3) : '—',
    ];
  });

  autoTable(doc, {
    startY,
    head: [[
      'Réf',
      'Désignation',
      'Qté\ncommandée',
      'Qté\nreçue',
      'Unité',
      'Prix\nHT',
      'Remise\n%',
      'TVA\n%',
      'Total\nHT'
    ]],
    body,
    margin: { top: startY, left: 10, right: 10 },
    tableWidth: 190,
    showHead: 'everyPage',
    willDrawPage: (data: any) => {
      if (data.pageNumber > 1) {
        data.cursor.y = 10;
      }
    },
    styles: {
      fontSize: 9,
      cellPadding: 3,
      valign: 'middle',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [232, 241, 255],
      textColor: 0,
      fontStyle: 'bold',
      halign: 'left',
      fontSize: 8,
      cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
      valign: 'middle',
    },
    alternateRowStyles: {
      fillColor: [252, 252, 252],
    },
    columnStyles: {
      0: { cellWidth: 16, halign: 'left' },              // Réf
      1: { cellWidth: 56, halign: 'left' },              // Désignation
      2: { cellWidth: 20, halign: 'right' }, // Qté commandée
      3: { cellWidth: 18, halign: 'right' }, // Qté reçue
      4: { cellWidth: 14, halign: 'center' },              // Unité
      5: { cellWidth: 18, halign: 'right' }, // Prix HT
      6: { cellWidth: 16, halign: 'right' }, // Remise %
      7: { cellWidth: 14, halign: 'right' }, // TVA %
      8: { cellWidth: 18, halign: 'right' }, // Total HT
    },
    theme: 'grid',
  });

  return (doc as any).lastAutoTable.finalY + 6;
}

function drawTotals(doc: jsPDF, receptionData: ReceptionData, startY: number, maxHeightBeforeFooter: number): void {
  try {
    const x = 125;
    const w = 75;
    const lineH = 6;
    const currencySymbol = receptionData.devise === 'TND' ? ' DT' : ` ${receptionData.devise}`;

    // Calculate remise amounts for display
    let totalHTBeforeDiscount = 0;
    let totalHTAfterLineDiscount = 0;
    
    if (receptionData.lignes && Array.isArray(receptionData.lignes)) {
      receptionData.lignes.forEach((l) => {
        if (l.prixUnitaireHT && l.qteRecue > 0) {
          const lineHTBeforeDiscount = l.prixUnitaireHT * l.qteRecue;
          totalHTBeforeDiscount += lineHTBeforeDiscount;
          const remisePct = l.remisePct || 0;
          const prixAvecRemise = remisePct > 0 
            ? l.prixUnitaireHT * (1 - remisePct / 100)
            : l.prixUnitaireHT;
          totalHTAfterLineDiscount += prixAvecRemise * l.qteRecue;
        } else if (l.totalLigneHT) {
          totalHTBeforeDiscount += (l.prixUnitaireHT || 0) * (l.qteRecue || 0);
          totalHTAfterLineDiscount += l.totalLigneHT;
        }
      });
    }
    
    const remiseFromLines = totalHTBeforeDiscount - totalHTAfterLineDiscount;
    const remiseGlobalePct = receptionData.remiseGlobalePct !== undefined && receptionData.remiseGlobalePct !== null 
      ? receptionData.remiseGlobalePct 
      : 0;
    
    // Calculate remise globale: apply percentage to totalHTAfterLineDiscount
    // The base should be totalHT after line discounts but before global discount
    // If totalHTAfterLineDiscount is calculated, use it; otherwise use receptionData.totalHT
    // But we need to account for the fact that receptionData.totalHT might already have remise globale applied
    // So we calculate from totalHTAfterLineDiscount if available
    const baseForRemiseGlobale = totalHTAfterLineDiscount > 0 
      ? totalHTAfterLineDiscount 
      : (receptionData.totalHT || 0);
    
    const remiseGlobale = remiseGlobalePct > 0 && baseForRemiseGlobale > 0
      ? baseForRemiseGlobale * (remiseGlobalePct / 100)
      : 0;

  // Count lines dynamically
  let lineCount = 2; // Total HT + Total TVA
  if (remiseFromLines > 0) {
    lineCount++;
  }
  if (remiseGlobale > 0) {
    lineCount++;
  }
  if (receptionData.fodecActif) {
    lineCount++;
  }
  if (receptionData.timbreActif !== undefined || receptionData.timbre !== undefined) {
    lineCount++;
  }
  lineCount++; // Total TTC

  const totalBoxH = 6 + (lineCount * lineH) + 6 + 7;

  const totalsY = maxHeightBeforeFooter - totalBoxH;
  const actualStartY = Math.min(startY, totalsY);

  doc.setFillColor(245, 246, 251);
  doc.roundedRect(x, actualStartY, w, totalBoxH, 3, 3, 'F');

  doc.setFontSize(9);
  let y = actualStartY + 6;

  // Show remise lignes if exists
  if (remiseFromLines > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(220, 38, 38);
    doc.text('Remise lignes', x + 4, y);
    doc.setFont('helvetica', 'bold');
    doc.text(`-${remiseFromLines.toFixed(3)}${currencySymbol}`, x + w - 4, y, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    y += lineH;
  }

  // Show remise globale if percentage is set (even if amount is 0)
  if (remiseGlobalePct > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(220, 38, 38);
    doc.text(`Remise globale (${remiseGlobalePct}%)`, x + 4, y);
    doc.setFont('helvetica', 'bold');
    doc.text(`-${remiseGlobale.toFixed(3)}${currencySymbol}`, x + w - 4, y, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    y += lineH;
  }

  doc.setFont('helvetica', 'normal');
  doc.text('Total HT', x + 4, y);
  doc.setFont('helvetica', 'bold');
  doc.text(`${receptionData.totalHT.toFixed(3)}${currencySymbol}`, x + w - 4, y, { align: 'right' });
  y += lineH;

  // Only show FODEC if active
  if (receptionData.fodecActif) {
    doc.setFont('helvetica', 'normal');
    doc.text(`FODEC (${receptionData.tauxFodec || 1}%)`, x + 4, y);
    doc.setFont('helvetica', 'bold');
    doc.text(`${(receptionData.fodec || 0).toFixed(3)}${currencySymbol}`, x + w - 4, y, { align: 'right' });
    y += lineH;
  }

  doc.setFont('helvetica', 'normal');
  doc.text('Total TVA', x + 4, y);
  doc.setFont('helvetica', 'bold');
  doc.text(`${receptionData.totalTVA.toFixed(3)}${currencySymbol}`, x + w - 4, y, { align: 'right' });
  y += lineH;

  // Always show TIMBRE if field exists
  if (receptionData.timbreActif !== undefined || receptionData.timbre !== undefined) {
    doc.setFont('helvetica', 'normal');
    const timbreLabel = receptionData.timbreActif 
      ? 'Timbre fiscal'
      : 'Timbre fiscal - Non activé';
    doc.text(timbreLabel, x + 4, y);
    doc.setFont('helvetica', 'bold');
    doc.text(`${(receptionData.timbre || 0).toFixed(3)}${currencySymbol}`, x + w - 4, y, { align: 'right' });
    y += lineH;
  }

  doc.setDrawColor(220, 220, 220);
  doc.line(x + 4, y + 1, x + w - 4, y + 1);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(47, 95, 255);
  doc.text('Total TTC', x + 4, y + 7);
  doc.text(`${receptionData.totalTTC.toFixed(3)}${currencySymbol}`, x + w - 4, y + 7, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  if (receptionData.notes) {
    const boxBottomY = actualStartY + totalBoxH;
    const maxWidth = 190;
    const splitNotes = doc.splitTextToSize(`Notes: ${receptionData.notes}`, maxWidth);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(102, 102, 102);
    
    splitNotes.forEach((line: string, idx: number) => {
      doc.text(line, 10, boxBottomY + 5 + (idx * 4));
    });
    doc.setTextColor(0, 0, 0);
  }
  
  } catch (error: any) {
    console.error('Error in drawTotals:', error);
    console.error('Error stack:', error.stack);
    // Draw a simple error message
    try {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(220, 38, 38);
      doc.text('Erreur lors du calcul des totaux', 10, startY + 10);
      doc.setTextColor(0, 0, 0);
    } catch (drawError) {
      console.error('Error drawing error message:', drawError);
    }
  }
}

function drawFooter(doc: jsPDF, companyInfo: CompanyInfo, footerY: number, pageNumber?: number, totalPages?: number): void {
  doc.setDrawColor(220, 220, 220);
  doc.line(10, footerY, 200, footerY);
  
  const yPos = footerY + 6;
  doc.setFontSize(9).setTextColor(0, 0, 0);

  const footerItems: string[] = [];

  const addressParts = [
    companyInfo.adresse.rue,
    companyInfo.adresse.ville,
    companyInfo.adresse.codePostal,
    companyInfo.adresse.pays
  ].filter(Boolean);
  if (addressParts.length > 0) {
    footerItems.push(addressParts.join(', '));
  }

  if (companyInfo.enTete?.telephone) {
    footerItems.push(`Tél : ${companyInfo.enTete.telephone}`);
  }

  if (companyInfo.enTete?.capitalSocial) {
    footerItems.push(`Capital social : ${companyInfo.enTete.capitalSocial}`);
  }

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

  if (footerItems.length > 0) {
    const footerText = footerItems.join(' - ');
    const centerX = 105;
    doc.text(footerText, centerX, yPos, { align: 'center' });
  }
  
  if (pageNumber !== undefined && totalPages !== undefined) {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    const pageText = `Page ${pageNumber} / ${totalPages}`;
    doc.text(pageText, 200 - 20, footerY - 5, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }
}

export function generateReceptionPdf(receptionData: ReceptionData, companyInfo: CompanyInfo): jsPDF {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageHeight = 297;
  const footerY = 280;

  let y = drawHeader(doc, companyInfo);
  y = drawReceptionTitle(doc);
  y = drawInfoBlocks(doc, receptionData, companyInfo, y);
  const tableEndY = drawLinesTable(doc, receptionData, y);
  
  const pageCount = doc.getNumberOfPages();
  
  const totalBoxH = 6 + (2 * 6) + 6 + 7 + (receptionData.notes ? 20 : 0);
  const availableSpace = footerY - tableEndY - 3;
  
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    drawFooter(doc, companyInfo, footerY, i, pageCount);
    
    if (i === pageCount) {
      if (availableSpace < totalBoxH + 10) {
        doc.addPage();
        drawTotals(doc, receptionData, 10, footerY - 3);
        drawFooter(doc, companyInfo, footerY, pageCount + 1, pageCount + 1);
      } else {
        drawTotals(doc, receptionData, tableEndY + 5, footerY - 3);
      }
    }
  }

  return doc;
}
