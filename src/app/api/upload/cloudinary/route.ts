import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { uploadFileToS3, deleteFileFromS3 } from '@/lib/s3';

// POST /api/upload/cloudinary - Uploader une image vers MinIO (S3)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const formData = await request.formData();
    let file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 });
    }

    // Vérifier le type de fichier (accepter les fichiers de caméra même sans type MIME)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif', 'image/bmp'];
    const hasImageExtension = /\.(jpg|jpeg|png|gif|webp|heic|heif|bmp)$/i.test(file.name || '');
    const hasImageMimeType = file.type && allowedTypes.includes(file.type);
    
    // Si le fichier n'a pas de type MIME, essayer de le déterminer à partir du nom
    if (!file.type || !hasImageMimeType) {
      const fileName = file.name || '';
      if (fileName.match(/\.(jpg|jpeg)$/i)) {
        file = new File([file], fileName, { type: 'image/jpeg' });
      } else if (fileName.match(/\.png$/i)) {
        file = new File([file], fileName, { type: 'image/png' });
      } else if (fileName.match(/\.gif$/i)) {
        file = new File([file], fileName, { type: 'image/gif' });
      } else if (fileName.match(/\.webp$/i)) {
        file = new File([file], fileName, { type: 'image/webp' });
      } else if (!file.type) {
        // Si aucun type et aucune extension, supposer JPEG (format par défaut des caméras)
        const newFileName = file.name || `camera-${Date.now()}.jpg`;
        file = new File([file], newFileName, { type: 'image/jpeg' });
      }
    }
    
    if (!hasImageMimeType && !hasImageExtension && !file.type?.startsWith('image/')) {
      return NextResponse.json({ 
        error: 'Type de fichier non autorisé. Seuls les fichiers JPEG, PNG, GIF, WebP, HEIC et BMP sont acceptés.' 
      }, { status: 400 });
    }

    // Vérifier la taille du fichier (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ 
        error: 'Fichier trop volumineux. Taille maximale: 10MB' 
      }, { status: 400 });
    }

    // Convertir File en ArrayBuffer puis Buffer pour MinIO
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Uploader l'image vers S3 (MinIO)
    const { url, key } = await uploadFileToS3(buffer, file.name, file.type);

    // Retourner les informations de l'image (format compatible avec l'ancien Cloudinary)
    return NextResponse.json({
      success: true,
      image: {
        id: key,
        name: file.name,
        url: url,
        publicId: key,
        type: file.type,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      }
    });

  } catch (error: any) {
    console.error('Erreur lors de l\'upload vers S3:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de l\'upload du fichier' },
      { status: 500 }
    );
  }
}

// DELETE /api/upload/cloudinary - Supprimer une image de MinIO (S3)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const publicId = searchParams.get('publicId'); // Ici publicId correspond à la key S3
    
    if (!publicId) {
      return NextResponse.json({ error: 'Key S3 manquante' }, { status: 400 });
    }

    await deleteFileFromS3(publicId);

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Erreur lors de la suppression de S3:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la suppression' },
      { status: 500 }
    );
  }
}


