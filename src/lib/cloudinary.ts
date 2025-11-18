import { v2 as cloudinary } from 'cloudinary';

// Configuration de Cloudinary
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (!cloudName || !apiKey || !apiSecret) {
  console.error('❌ Cloudinary configuration missing!');
  console.error('Cloud Name:', cloudName ? '✓' : '✗');
  console.error('API Key:', apiKey ? '✓' : '✗');
  console.error('API Secret:', apiSecret ? '✓' : '✗');
  throw new Error('Cloudinary configuration is incomplete. Please check your .env.local file.');
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
});

export default cloudinary;

// Fonction pour uploader une image vers Cloudinary
export async function uploadImageToCloudinary(
  file: File | Buffer | ArrayBuffer,
  folder: string = 'erp-uploads',
  options?: {
    resource_type?: 'image' | 'video' | 'raw' | 'auto';
    transformation?: any[];
    public_id?: string;
  }
): Promise<{
  public_id: string;
  secure_url: string;
  url: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
}> {
  return new Promise(async (resolve, reject) => {
    try {
      let buffer: Buffer;
      
      // Convertir File/ArrayBuffer en buffer si nécessaire
      if (Buffer.isBuffer(file)) {
        buffer = file;
      } else if (file instanceof ArrayBuffer) {
        buffer = Buffer.from(file);
      } else {
        // Si c'est un File (Web API), le convertir en ArrayBuffer puis Buffer
        const arrayBuffer = await (file as any).arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
      }

      // Uploader l'image vers Cloudinary
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folder,
          resource_type: options?.resource_type || 'image',
          transformation: options?.transformation,
          public_id: options?.public_id,
          // Optimisation automatique des images
          quality: 'auto',
          fetch_format: 'auto',
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else if (result) {
            resolve({
              public_id: result.public_id,
              secure_url: result.secure_url,
              url: result.url,
              width: result.width || 0,
              height: result.height || 0,
              format: result.format || '',
              bytes: result.bytes || 0,
            });
          } else {
            reject(new Error('Upload failed: No result returned'));
          }
        }
      );

      // Écrire les données dans le stream
      uploadStream.end(buffer);
    } catch (error) {
      reject(error);
    }
  });
}

// Fonction pour supprimer une image de Cloudinary
export async function deleteImageFromCloudinary(publicId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

