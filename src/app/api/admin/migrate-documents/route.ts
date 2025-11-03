import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;

    // Check if documents collection exists
    const collections = await db.listCollections().toArray();
    const hasDocuments = collections.some(c => c.name === 'documents');
    
    if (!hasDocuments) {
      return NextResponse.json({ 
        success: true, 
        message: 'Rien à migrer',
        migrated: 0 
      });
    }

    // Count documents in old collection
    const count = await db.collection('documents').countDocuments();

    if (count === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'Rien à migrer',
        migrated: 0 
      });
    }

    // Get all documents
    const documents = await db.collection('documents').find({}).toArray();

    // Insert into devis collection
    const devisCollection = db.collection('devis');
    
    let inserted = 0;
    let errors = [];
    
    for (const doc of documents) {
      try {
        await devisCollection.insertOne(doc);
        inserted++;
      } catch (err: any) {
        if (err.code === 11000) {
          // Duplicate - skip
        } else {
          errors.push({ numero: doc.numero, error: err.message });
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      migrated: inserted,
      total: documents.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Erreur migration:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

