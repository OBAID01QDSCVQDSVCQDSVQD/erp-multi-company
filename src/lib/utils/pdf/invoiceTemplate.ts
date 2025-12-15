import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { generateDevisPdf } from './devisTemplate';

// Reuse the same helper functions from devisTemplate
// Just export a wrapper that uses generateDevisPdf with documentType = 'FACTURE'

interface InvoiceLine {
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

interface InvoiceData {
  numero: string;
  dateDoc: string;
  dateEcheance?: string;
  customerName?: string;
  customerAddress?: string;
  customerMatricule?: string;
  customerCode?: string;
  customerPhone?: string;
  referenceExterne?: string; // original invoice number for avoir
  devise: string;
  lignes: InvoiceLine[];
  totalBaseHT: number;
  totalRemise?: number;
  totalTVA: number;
  timbreFiscal?: number;
  totalTTC: number;
  modePaiement?: string;
  conditionsPaiement?: string;
  notes?: string;
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

export function generateInvoicePdf(invoiceData: InvoiceData, companyInfo: CompanyInfo): jsPDF {
  // Convert invoice data to quote data format (they're compatible)
  const quoteData = {
    ...invoiceData,
    documentType: 'FACTURE',
    dateValidite: invoiceData.dateEcheance, // Use dateEcheance as validité equivalent
    statut: invoiceData.statut, // Pass status for watermark
  };
  
  // Use the same PDF generator but with documentType = 'FACTURE'
  return generateDevisPdf(quoteData, companyInfo);
}

export function generateCreditNotePdf(invoiceData: InvoiceData, companyInfo: CompanyInfo): jsPDF {
  const quoteData = {
    ...invoiceData,
    documentType: 'AVOIR',
    dateValidite: invoiceData.dateEcheance,
    referenceExterne: invoiceData.referenceExterne,
  };

  return generateDevisPdf(quoteData, companyInfo);
}

