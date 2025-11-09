import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { generateDevisPdf } from './devisTemplate';

// Reuse the same helper functions from devisTemplate
// Just export a wrapper that uses generateDevisPdf with documentType = 'BON DE LIVRAISON'

interface DeliveryLine {
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

interface DeliveryData {
  numero: string;
  dateDoc: string;
  dateLivraisonPrevue?: string;
  dateLivraisonReelle?: string;
  customerName?: string;
  customerAddress?: string;
  customerMatricule?: string;
  customerCode?: string;
  customerPhone?: string;
  devise: string;
  lignes: DeliveryLine[];
  totalBaseHT: number;
  totalRemise?: number;
  totalTVA: number;
  timbreFiscal?: number;
  totalTTC: number;
  modePaiement?: string;
  notes?: string;
  lieuLivraison?: string;
  moyenTransport?: string;
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

export function generateDeliveryPdf(deliveryData: DeliveryData, companyInfo: CompanyInfo): jsPDF {
  // Convert delivery data to quote data format (they're compatible)
  const quoteData = {
    ...deliveryData,
    documentType: 'BON DE LIVRAISON',
    // Keep all delivery-specific fields
    dateLivraisonPrevue: deliveryData.dateLivraisonPrevue,
    dateLivraisonReelle: deliveryData.dateLivraisonReelle,
    lieuLivraison: deliveryData.lieuLivraison,
    moyenTransport: deliveryData.moyenTransport,
    // Don't override with dateValidite or adresseLivraison for delivery notes
  };
  
  // Use the same PDF generator but with documentType = 'BON DE LIVRAISON'
  return generateDevisPdf(quoteData, companyInfo);
}

