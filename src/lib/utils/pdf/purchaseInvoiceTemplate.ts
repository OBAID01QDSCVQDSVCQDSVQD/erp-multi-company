import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface InvoiceLine {
  designation?: string;
  quantite: number;
  prixUnitaireHT?: number;
  remisePct?: number;
  tvaPct?: number;
  totalLigneHT?: number;
}

interface PurchaseInvoiceData {
  numero: string;
  dateFacture: string;
  documentType: string;
  referenceFournisseur?: string;
  supplierName?: string;
  supplierAddress?: string;
  supplierMatricule?: string;
  supplierPhone?: string;
  devise: string;
  lignes: InvoiceLine[];
  totalHT: number;
  totalRemise?: number;
  fodec?: number;
  totalTVA: number;
  timbre?: number;
  totalTTC: number;
  fodecActif?: boolean;
  tauxFodec?: number;
  timbreActif?: boolean;
  montantTimbre?: number;
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
  
  // Display full address
  const addressParts = [
    companyInfo.adresse.rue,
    companyInfo.adresse.codePostal,
    companyInfo.adresse.ville,
    companyInfo.adresse.pays
  ].filter(Boolean);
  
  let currentY = topY + 5;
  
  if (addressParts.length > 0) {
    const fullAddress = addressParts.join(', ');
    // Wrap address if too long
    const addressWidth = 120;
    const splitAddress = doc.splitTextToSize(fullAddress, addressWidth);
    splitAddress.forEach((line: string, idx: number) => {
      doc.text(line, rightX, currentY + (idx * 4));
    });
    currentY += splitAddress.length * 4;
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
      currentY
    );
    currentY += 5;
  }

  if (companyInfo.enTete?.matriculeFiscal) {
    doc.text(`Matricule : ${companyInfo.enTete.matriculeFiscal}`, rightX, currentY);
  }

  return 10 + 32 + 4;
}

function drawInvoiceTitle(doc: jsPDF): number {
  const startY = 10 + 32 + 8;
  
  doc.setFontSize(16).setFont('helvetica', 'bold');
  doc.setTextColor(47, 95, 255);
  doc.text('FACTURE D\'ACHAT', 10, startY);
  doc.setTextColor(0, 0, 0);
  
  return startY + 8;
}

function drawInfoBlocks(doc: jsPDF, invoiceData: PurchaseInvoiceData, companyInfo: CompanyInfo, startY: number): number {
  const col1X = 12;
  const col2X = 75;
  const supplierX = 120;
  const h = 28;

  doc.setFontSize(9).setFont('helvetica', 'normal');
  doc.text('Numéro de facture', col1X, startY + 4);
  doc.setTextColor(47, 95, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(invoiceData.numero, col1X, startY + 10);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');

  // Date
  doc.text('Date', col2X, startY + 4);
  doc.setFont('helvetica', 'bold');
  doc.text(new Date(invoiceData.dateFacture).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }), col2X, startY + 10);
  doc.setFont('helvetica', 'normal');

  // Reference fournisseur
  if (invoiceData.referenceFournisseur) {
    doc.text('N° facture fournisseur', col1X, startY + 17);
    doc.setFont('helvetica', 'bold');
    doc.text(invoiceData.referenceFournisseur, col1X, startY + 23);
    doc.setFont('helvetica', 'normal');
  }

  // Statut
  doc.text('Statut', col2X, startY + 17);
  doc.setFont('helvetica', 'bold');
  const statutText = invoiceData.statut === 'VALIDEE' ? 'Validée' : 
                      invoiceData.statut === 'PARTIELLEMENT_PAYEE' ? 'Partiellement payée' :
                      invoiceData.statut === 'PAYEE' ? 'Payée' :
                      invoiceData.statut === 'ANNULEE' ? 'Annulée' : 'Brouillon';
  doc.text(statutText, col2X, startY + 23);
  doc.setFont('helvetica', 'normal');

  // Bloc fournisseur
  let textY = startY + 12;
  let dynamicHeight = 6;
  
  let addressLines = 0;
  if (invoiceData.supplierAddress) {
    const addressText = `Adresse: ${invoiceData.supplierAddress}`;
    const addressWidth = 72;
    const splitAddress = doc.splitTextToSize(addressText, addressWidth);
    addressLines = splitAddress.length;
    dynamicHeight += 5 + (addressLines * 4);
  } else {
    dynamicHeight += 5;
  }
  
  if (invoiceData.supplierPhone) {
    dynamicHeight += 5;
  }
  
  if (invoiceData.supplierMatricule) {
    dynamicHeight += 5;
  }
  
  dynamicHeight = Math.max(dynamicHeight, h);
  
  doc.setFillColor(238, 244, 255);
  doc.roundedRect(supplierX, startY, 80, dynamicHeight, 3, 3, 'F');
  
  doc.setFontSize(9).setFont('helvetica', 'bold');
  doc.text('Fournisseur', supplierX + 4, startY + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(invoiceData.supplierName || '—', supplierX + 4, textY);
  textY += 5;
  
  if (invoiceData.supplierAddress) {
    const addressText = `Adresse: ${invoiceData.supplierAddress}`;
    const addressWidth = 72;
    const splitAddress = doc.splitTextToSize(addressText, addressWidth);
    splitAddress.forEach((line: string, idx: number) => {
      doc.text(line, supplierX + 4, textY + (idx * 4));
    });
    textY += splitAddress.length * 4;
  }
  
  if (invoiceData.supplierPhone) {
    doc.text(`Tél: ${invoiceData.supplierPhone}`, supplierX + 4, textY);
    textY += 5;
  }
  
  if (invoiceData.supplierMatricule) {
    doc.text(`Matricule: ${invoiceData.supplierMatricule}`, supplierX + 4, textY);
  }

  return startY + dynamicHeight + 6;
}

function drawLinesTable(doc: jsPDF, invoiceData: PurchaseInvoiceData, startY: number): number {
  const body = invoiceData.lignes.map((l) => {
    return [
      l.designation || '—',
      l.quantite.toString(),
      l.prixUnitaireHT ? l.prixUnitaireHT.toFixed(3) : '—',
      l.remisePct ? `${l.remisePct} %` : '—',
      l.tvaPct ? `${l.tvaPct} %` : '—',
      l.totalLigneHT ? l.totalLigneHT.toFixed(3) : '—',
    ];
  });

  autoTable(doc, {
    startY,
    head: [[
      'Désignation',
      'Quantité',
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
      0: { cellWidth: 80, halign: 'left' },              // Désignation
      1: { cellWidth: 22, halign: 'right' }, // Quantité
      2: { cellWidth: 26, halign: 'right' }, // Prix HT
      3: { cellWidth: 22, halign: 'right' }, // Remise %
      4: { cellWidth: 20, halign: 'right' }, // TVA %
      5: { cellWidth: 20, halign: 'right' }, // Total HT
    },
    theme: 'grid',
  });

  return (doc as any).lastAutoTable.finalY + 6;
}

function drawTotals(doc: jsPDF, invoiceData: PurchaseInvoiceData, startY: number, maxHeightBeforeFooter: number): void {
  const x = 125;
  const w = 75;
  const lineH = 6;
  const currencySymbol = invoiceData.devise === 'TND' ? ' DT' : ` ${invoiceData.devise}`;

  // Count lines dynamically
  let lineCount = 2; // Total HT + Total TVA
  if (invoiceData.totalRemise && invoiceData.totalRemise > 0) {
    lineCount++;
  }
  if (invoiceData.fodecActif) {
    lineCount++;
  }
  if (invoiceData.timbreActif !== undefined || invoiceData.timbre !== undefined) {
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

  // Total Remise (if exists)
  if (invoiceData.totalRemise && invoiceData.totalRemise > 0) {
    doc.setFont('helvetica', 'normal');
    doc.text('Total Remise', x + 4, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38); // Red color
    doc.text(`-${invoiceData.totalRemise.toFixed(3)}${currencySymbol}`, x + w - 4, y, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    y += lineH;
  }

  doc.setFont('helvetica', 'normal');
  doc.text('Total HT', x + 4, y);
  doc.setFont('helvetica', 'bold');
  doc.text(`${invoiceData.totalHT.toFixed(3)}${currencySymbol}`, x + w - 4, y, { align: 'right' });
  y += lineH;

  // Only show FODEC if active
  if (invoiceData.fodecActif) {
    doc.setFont('helvetica', 'normal');
    doc.text(`FODEC (${invoiceData.tauxFodec || 1}%)`, x + 4, y);
    doc.setFont('helvetica', 'bold');
    doc.text(`${(invoiceData.fodec || 0).toFixed(3)}${currencySymbol}`, x + w - 4, y, { align: 'right' });
    y += lineH;
  }

  doc.setFont('helvetica', 'normal');
  doc.text('Total TVA', x + 4, y);
  doc.setFont('helvetica', 'bold');
  doc.text(`${invoiceData.totalTVA.toFixed(3)}${currencySymbol}`, x + w - 4, y, { align: 'right' });
  y += lineH;

  // Always show TIMBRE if field exists
  if (invoiceData.timbreActif !== undefined || invoiceData.timbre !== undefined) {
    doc.setFont('helvetica', 'normal');
    const timbreLabel = invoiceData.timbreActif 
      ? 'Timbre fiscal'
      : 'Timbre fiscal - Non activé';
    doc.text(timbreLabel, x + 4, y);
    doc.setFont('helvetica', 'bold');
    doc.text(`${(invoiceData.timbre || 0).toFixed(3)}${currencySymbol}`, x + w - 4, y, { align: 'right' });
    y += lineH;
  }

  doc.setDrawColor(220, 220, 220);
  doc.line(x + 4, y + 1, x + w - 4, y + 1);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(47, 95, 255);
  doc.text('Total TTC', x + 4, y + 7);
  doc.text(`${invoiceData.totalTTC.toFixed(3)}${currencySymbol}`, x + w - 4, y + 7, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  if (invoiceData.notes) {
    const boxBottomY = actualStartY + totalBoxH;
    const maxWidth = 190;
    const splitNotes = doc.splitTextToSize(`Notes: ${invoiceData.notes}`, maxWidth);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(102, 102, 102);
    
    splitNotes.forEach((line: string, idx: number) => {
      doc.text(line, 10, boxBottomY + 5 + (idx * 4));
    });
    doc.setTextColor(0, 0, 0);
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

export function generatePurchaseInvoicePdf(invoiceData: PurchaseInvoiceData, companyInfo: CompanyInfo | null): jsPDF {
  if (!companyInfo) {
    companyInfo = {
      nom: '',
      adresse: { rue: '', ville: '', codePostal: '', pays: '' },
    };
  }

  const doc = new jsPDF('p', 'mm', 'a4');
  const pageHeight = 297;
  const footerY = 280;

  let y = drawHeader(doc, companyInfo);
  y = drawInvoiceTitle(doc);
  y = drawInfoBlocks(doc, invoiceData, companyInfo, y);
  const tableEndY = drawLinesTable(doc, invoiceData, y);
  
  const pageCount = doc.getNumberOfPages();
  
  const totalBoxH = 6 + (2 * 6) + 6 + 7 + (invoiceData.notes ? 20 : 0);
  const availableSpace = footerY - tableEndY - 3;
  
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    drawFooter(doc, companyInfo, footerY, i, pageCount);
    
    if (i === pageCount) {
      if (availableSpace < totalBoxH + 10) {
        doc.addPage();
        drawTotals(doc, invoiceData, 10, footerY - 3);
        drawFooter(doc, companyInfo, footerY, pageCount + 1, pageCount + 1);
      } else {
        drawTotals(doc, invoiceData, tableEndY + 5, footerY - 3);
      }
    }
  }

  return doc;
}

