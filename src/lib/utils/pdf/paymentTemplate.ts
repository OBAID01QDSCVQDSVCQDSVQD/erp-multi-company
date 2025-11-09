import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PaymentLine {
  numeroFacture: string;
  referenceFournisseur?: string;
  montantFacture: number;
  montantPayeAvant: number;
  montantPaye: number;
  soldeRestant: number;
}

interface PaymentData {
  numero: string;
  datePaiement: string;
  supplierName?: string;
  supplierAddress?: string;
  supplierMatricule?: string;
  supplierPhone?: string;
  modePaiement: string;
  reference?: string;
  montantTotal: number;
  lignes: PaymentLine[];
  notes?: string;
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
  let currentY = 15;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 138);
  doc.text(companyInfo.nom, rightX, currentY);
  currentY += 7;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(75, 85, 99);

  if (companyInfo.adresse.rue) {
    const addressText = `${companyInfo.adresse.rue}, ${companyInfo.adresse.codePostal} ${companyInfo.adresse.ville}, ${companyInfo.adresse.pays}`;
    const addressLines = doc.splitTextToSize(addressText, 80);
    doc.text(addressLines, rightX, currentY);
    currentY += addressLines.length * 5;
  }

  if (companyInfo.enTete?.telephone) {
    doc.text(`Tél: ${companyInfo.enTete.telephone}`, rightX, currentY);
    currentY += 5;
  }

  if (companyInfo.enTete?.email) {
    doc.text(`Email: ${companyInfo.enTete.email}`, rightX, currentY);
    currentY += 5;
  }

  if (companyInfo.enTete?.matriculeFiscal) {
    doc.text(`Matricule Fisc: ${companyInfo.enTete.matriculeFiscal}`, rightX, currentY);
    currentY += 5;
  }

  return Math.max(bottomLogo, currentY) + 5;
}

function drawTitle(doc: jsPDF, y: number, paymentData: PaymentData): number {
  doc.setFillColor(59, 130, 246);
  doc.roundedRect(10, y, 190, 12, 2, 2, 'F');

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('REÇU DE PAIEMENT FOURNISSEUR', 105, y + 8, { align: 'center' });

  return y + 15;
}

function drawPaymentInfo(doc: jsPDF, y: number, paymentData: PaymentData, companyInfo: CompanyInfo): number {
  const startY = y;

  // Left column - Payment info
  let leftY = startY;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 138);
  doc.text('INFORMATIONS DU PAIEMENT', 15, leftY);
  leftY += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(75, 85, 99);

  doc.text('N° Paiement:', 15, leftY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(paymentData.numero, 50, leftY);
  leftY += 6;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(75, 85, 99);
  doc.text('Date:', 15, leftY);
  doc.setTextColor(0, 0, 0);
  const dateStr = new Date(paymentData.datePaiement).toLocaleDateString('fr-FR');
  doc.text(dateStr, 50, leftY);
  leftY += 6;

  doc.setTextColor(75, 85, 99);
  doc.text('Mode de paiement:', 15, leftY);
  doc.setTextColor(0, 0, 0);
  doc.text(paymentData.modePaiement, 60, leftY);
  leftY += 6;

  if (paymentData.reference) {
    doc.setTextColor(75, 85, 99);
    doc.text('Référence:', 15, leftY);
    doc.setTextColor(0, 0, 0);
    doc.text(paymentData.reference, 50, leftY);
    leftY += 6;
  }

  // Right column - Supplier info
  let rightY = startY;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 138);
  doc.text('FOURNISSEUR', 115, rightY);
  rightY += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);

  if (paymentData.supplierName) {
    doc.text(paymentData.supplierName, 115, rightY);
    rightY += 6;
  }

  if (paymentData.supplierAddress) {
    const addressLines = doc.splitTextToSize(paymentData.supplierAddress, 85);
    doc.text(addressLines, 115, rightY);
    rightY += addressLines.length * 5;
  }

  if (paymentData.supplierMatricule) {
    doc.setTextColor(75, 85, 99);
    doc.text(`Matricule: ${paymentData.supplierMatricule}`, 115, rightY);
    rightY += 6;
  }

  return Math.max(leftY, rightY) + 10;
}

function drawLinesTable(doc: jsPDF, y: number, paymentData: PaymentData): number {
  const tableData = paymentData.lignes.map((line) => [
    line.referenceFournisseur || line.numeroFacture || '—',
    line.montantFacture.toFixed(3),
    line.montantPayeAvant.toFixed(3),
    line.montantPaye.toFixed(3),
    line.soldeRestant.toFixed(3),
  ]);

  autoTable(doc, {
    startY: y,
    head: [['N° Facture Fournisseur', 'Montant Total', 'Déjà Payé', 'Montant Payé', 'Solde Restant']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [0, 0, 0],
    },
    columnStyles: {
      0: { cellWidth: 45, halign: 'left' },
      1: { cellWidth: 40, halign: 'right' },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 35, halign: 'right' },
      4: { cellWidth: 35, halign: 'right' },
    },
    margin: { left: 15, right: 15 },
    styles: {
      cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
    },
  });

  return (doc as any).lastAutoTable.finalY + 10;
}

function drawTotals(doc: jsPDF, y: number, paymentData: PaymentData): number {
  const boxWidth = 70;
  const boxHeight = 25;
  const boxX = 135;
  const boxY = y;

  doc.setFillColor(249, 250, 251);
  doc.roundedRect(boxX, boxY, boxWidth, boxHeight, 2, 2, 'F');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('MONTANT TOTAL', boxX + 5, boxY + 8);

  doc.setFontSize(14);
  doc.setTextColor(34, 197, 94);
  const totalText = `${paymentData.montantTotal.toFixed(3)} DT`;
  const totalWidth = doc.getTextWidth(totalText);
  doc.text(totalText, boxX + boxWidth - totalWidth - 5, boxY + 20);

  return boxY + boxHeight + 10;
}

function drawFooter(doc: jsPDF, y: number, companyInfo: CompanyInfo, paymentData: PaymentData): void {
  const pageHeight = doc.internal.pageSize.height;
  let footerY = pageHeight - 40;

  if (paymentData.notes) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(75, 85, 99);
    const notesLines = doc.splitTextToSize(`Notes: ${paymentData.notes}`, 190);
    doc.text(notesLines, 15, footerY);
    footerY += notesLines.length * 5 + 5;
  }

  doc.setDrawColor(200, 200, 200);
  doc.line(15, footerY, 195, footerY);
  footerY += 5;

  if (companyInfo.piedPage?.coordonneesBancaires) {
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    const bankInfo = companyInfo.piedPage.coordonneesBancaires;
    let bankY = footerY;
    if (bankInfo.banque) {
      doc.text(`Banque: ${bankInfo.banque}`, 15, bankY);
      bankY += 4;
    }
    if (bankInfo.rib) {
      doc.text(`RIB: ${bankInfo.rib}`, 15, bankY);
      bankY += 4;
    }
    if (bankInfo.swift) {
      doc.text(`SWIFT: ${bankInfo.swift}`, 15, bankY);
      bankY += 4;
    }
    footerY = bankY + 2;
  }

  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text(
    `Document généré le ${new Date().toLocaleDateString('fr-FR')} - Page 1`,
    105,
    footerY,
    { align: 'center' }
  );
}

export function generatePaymentPdf(paymentData: PaymentData, companyInfo: CompanyInfo): jsPDF {
  const doc = new jsPDF('p', 'mm', 'a4');

  let currentY = drawHeader(doc, companyInfo);
  currentY = drawTitle(doc, currentY, paymentData);
  currentY = drawPaymentInfo(doc, currentY, paymentData, companyInfo);
  currentY = drawLinesTable(doc, currentY, paymentData);
  currentY = drawTotals(doc, currentY, paymentData);
  drawFooter(doc, currentY, companyInfo, paymentData);

  return doc;
}

