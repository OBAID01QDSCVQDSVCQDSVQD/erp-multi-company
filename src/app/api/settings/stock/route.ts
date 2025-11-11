import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import CompanySettings from '@/lib/models/CompanySettings';

// GET /api/settings/stock
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId;
    if (!tenantId) return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 400 });
    await connectDB();
    let settings = await (CompanySettings as any).findOne({ tenantId });
    if (!settings) {
      // getOrCreate: créer avec defaults implicites du schéma
      settings = new CompanySettings({ tenantId, societe: { nom: 'Nouvelle Entreprise', adresse: { rue: 'Non spécifié', ville: 'Non spécifié', codePostal: '0000', pays: 'Tunisie' }, tva: 'Non spécifié', devise: 'TND', langue: 'fr', fuseau: 'Africa/Tunis' }, numerotation: { devis: 'DEV-{{YYYY}}-{{SEQ:5}}', bl: 'BL-{{YY}}{{MM}}-{{SEQ:4}}', facture: 'FAC-{{YYYY}}-{{SEQ:5}}', avoir: 'AVR-{{YYYY}}-{{SEQ:5}}' }, ventes: {}, achats: {}, depenses: {}, stock: {}, securite: {}, systeme: {}, tva: {} } as any);
      await (settings as any).save();
    }
    return NextResponse.json(settings.stock);
  } catch (error) {
    console.error('Erreur GET /settings/stock:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// PATCH /api/settings/stock
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId;
    if (!tenantId) return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 400 });
    const body = await request.json();
    await connectDB();
    const settings = await (CompanySettings as any).findOne({ tenantId });
    if (!settings) return NextResponse.json({ error: 'Paramètres introuvables' }, { status: 404 });
    // Mise à jour partielle sécurisée
    settings.stock = { ...settings.stock.toObject(), ...body };
    await (settings as any).save();
    return NextResponse.json(settings.stock);
  } catch (error) {
    console.error('Erreur PATCH /settings/stock:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}


