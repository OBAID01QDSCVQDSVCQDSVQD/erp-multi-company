import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { uploadImageToCloudinary } from '@/lib/cloudinary';

// POST /api/upload/cloudinary - Uploader une image vers Cloudinary
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const folder = (formData.get('folder') as string) || 'erp-uploads';
    
    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 });
    }

    // Vérifier le type de fichier
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Type de fichier non autorisé. Seuls les fichiers JPEG, PNG, GIF et WebP sont acceptés.' 
      }, { status: 400 });
    }

    // Vérifier la taille du fichier (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ 
        error: 'Fichier trop volumineux. Taille maximale: 10MB' 
      }, { status: 400 });
    }

    // Convertir File en ArrayBuffer puis Buffer pour Cloudinary
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Uploader l'image vers Cloudinary
    const uploadResult = await uploadImageToCloudinary(buffer, folder);

    // Retourner les informations de l'image
    return NextResponse.json({
      success: true,
      image: {
        id: uploadResult.public_id,
        name: file.name,
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        type: file.type,
        size: uploadResult.bytes,
        width: uploadResult.width,
        height: uploadResult.height,
        format: uploadResult.format,
        uploadedAt: new Date().toISOString(),
      }
    });

  } catch (error: any) {
    console.error('Erreur lors de l\'upload vers Cloudinary:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de l\'upload du fichier' },
      { status: 500 }
    );
  }
}

// DELETE /api/upload/cloudinary - Supprimer une image de Cloudinary
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const publicId = searchParams.get('publicId');
    
    if (!publicId) {
      return NextResponse.json({ error: 'Public ID manquant' }, { status: 400 });
    }

    const { deleteImageFromCloudinary } = await import('@/lib/cloudinary');
    await deleteImageFromCloudinary(publicId);

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Erreur lors de la suppression de Cloudinary:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la suppression' },
      { status: 500 }
    );
  }
}

