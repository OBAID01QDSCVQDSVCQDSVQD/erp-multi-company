
import mongoose from 'mongoose';
import Document from './src/lib/models/Document';
import connectDB from './src/lib/mongodb';
import dotenv from 'dotenv';
dotenv.config();

const docId = '6940bf3846d594c0cdfd66a5';

async function check() {
    await connectDB();
    const doc = await (Document as any).findById(docId);
    console.log('Document Type:', doc?.type);
    console.log('Document Numero:', doc?.numero);
    console.log('Full Doc:', JSON.stringify(doc, null, 2));
    process.exit();
}

check();
