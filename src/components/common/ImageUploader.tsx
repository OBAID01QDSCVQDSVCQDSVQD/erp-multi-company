'use client';

import { useState, useRef } from 'react';
import { PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import toast from 'react-hot-toast';

export interface ImageData {
  id: string;
  name: string;
  url: string; // Cloudinary URL
  publicId?: string; // Cloudinary public ID
  type: string;
  size: number;
  width?: number;
  height?: number;
  format?: string;
}

interface ImageUploaderProps {
  images: ImageData[];
  onChange: (images: ImageData[]) => void;
  maxImages?: number;
  maxSizeMB?: number;
  accept?: string;
  label?: string;
  folder?: string; // Cloudinary folder
}

export default function ImageUploader({
  images,
  onChange,
  maxImages = 10,
  maxSizeMB = 5,
  accept = 'image/*',
  label = 'Ajouter des images',
  folder = 'erp-uploads',
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    const filesArray = Array.from(files);

    // Vérifier le nombre d'images
    if (images.length + filesArray.length > maxImages) {
      toast.error(`Vous pouvez ajouter un maximum de ${maxImages} images`);
      return;
    }

    setUploading(true);
    const newImages: ImageData[] = [];

    try {
      // Uploader chaque image vers Cloudinary
      for (const file of filesArray) {
        // Vérifier le type de fichier (permettre les fichiers sans type MIME pour les images de caméra)
        const hasImageExtension = file.name.match(/\.(jpg|jpeg|png|gif|webp|bmp|heic|heif)$/i);
        const hasImageMimeType = file.type && file.type.startsWith('image/');
        const isImageFile = hasImageMimeType || hasImageExtension || (!file.type && file.size > 0);
        
        if (!isImageFile) {
          toast.error(`Le fichier ${file.name || 'fichier'} n'est pas une image`);
          continue;
        }

        // Vérifier la taille du fichier
        if (file.size > maxSizeBytes) {
          toast.error(`La taille de l'image ${file.name || 'fichier'} dépasse ${maxSizeMB}MB`);
          continue;
        }

        // S'assurer que le fichier a un nom et un type MIME (pour les fichiers de caméra)
        let fileName = file.name || '';
        let fileType = file.type || '';
        
        // Si pas de nom ou nom générique, créer un nom unique
        if (!fileName || fileName === 'image.jpg' || fileName === 'image.jpeg' || fileName === 'image.png' || fileName.startsWith('blob:')) {
          const extension = fileType.includes('png') ? 'png' : 
                           fileType.includes('gif') ? 'gif' : 
                           fileType.includes('webp') ? 'webp' : 
                           fileType.includes('heic') ? 'heic' :
                           fileType.includes('heif') ? 'heif' : 'jpg';
          fileName = `camera-${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`;
        }
        
        // Si pas de type MIME, essayer de le déterminer
        if (!fileType) {
          const ext = fileName.split('.').pop()?.toLowerCase();
          const mimeTypes: { [key: string]: string } = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'heic': 'image/heic',
            'heif': 'image/heif',
            'bmp': 'image/bmp',
          };
          fileType = mimeTypes[ext || ''] || 'image/jpeg';
        }

        // Créer un nouveau fichier avec le nom والنوع الصحيح
        let fileToUpload = file;
        if (fileName !== file.name || fileType !== file.type) {
          fileToUpload = new File([file], fileName, { type: fileType });
        }

        // Uploader l'image vers Cloudinary
        const formData = new FormData();
        formData.append('file', fileToUpload);
        formData.append('folder', folder);

        const response = await fetch('/api/upload/cloudinary', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.image) {
            const newImage: ImageData = {
              id: result.image.id || result.image.publicId || `${Date.now()}-${Math.random()}`,
              name: result.image.name || fileName || file.name || 'image',
              url: result.image.url,
              publicId: result.image.publicId,
              type: result.image.type || file.type || 'image/jpeg',
              size: result.image.size || file.size,
              width: result.image.width,
              height: result.image.height,
              format: result.image.format,
            };
            newImages.push(newImage);
          } else {
            console.error('Réponse Cloudinary invalide:', result);
            toast.error(`Erreur: réponse invalide lors de l'upload de ${fileName || file.name || 'fichier'}`);
          }
        } else {
          const errorText = await response.text();
          let errorMessage = 'Erreur inconnue';
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.error || errorMessage;
          } catch (e) {
            errorMessage = errorText || errorMessage;
          }
          console.error('Erreur upload Cloudinary:', errorMessage);
          toast.error(`Erreur lors de l'upload de ${fileName || file.name || 'fichier'}: ${errorMessage}`);
        }
      }

      // Ajouter les images uploadées avec succès à la liste
      if (newImages.length > 0) {
        const updatedImages = [...images, ...newImages];
        console.log('ImageUploader: Adding images to state', {
          currentImagesCount: images.length,
          newImagesCount: newImages.length,
          newImages: newImages,
          updatedImagesCount: updatedImages.length,
        });
        onChange(updatedImages);
        toast.success(`${newImages.length} image(s) uploadée(s) avec succès`);
      } else {
        console.log('ImageUploader: No images to add', {
          filesProcessed: filesArray.length,
          currentImagesCount: images.length,
        });
      }
    } catch (error: any) {
      console.error('Error uploading images:', error);
      toast.error('Erreur lors de l\'upload des images');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleRemove = async (id: string) => {
    const imageToRemove = images.find((img) => img.id === id);
    
    // Si l'image est dans Cloudinary, la supprimer
    if (imageToRemove?.publicId) {
      try {
        const response = await fetch(`/api/upload/cloudinary?publicId=${imageToRemove.publicId}`, {
          method: 'DELETE',
        });
        
        if (!response.ok) {
          console.error('Failed to delete image from Cloudinary');
        }
      } catch (error) {
        console.error('Error deleting image from Cloudinary:', error);
      }
    }
    
    // Retirer l'image de la liste
    onChange(images.filter((img) => img.id !== id));
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleCameraClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    cameraInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}

      {/* منطقة السحب والإفلات */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400 bg-gray-50'
          }
        `}
      >
        <PhotoIcon className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-2 text-sm text-gray-600">
          {uploading ? 'Upload en cours...' : 'Cliquez ou glissez les images ici pour les uploader'}
        </p>
        <div className="flex items-center justify-center gap-2 mt-2">
          <button
            type="button"
            onClick={handleCameraClick}
            className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            📷 Prendre une photo
          </button>
          <span className="text-xs text-gray-400">ou</span>
          <span className="text-xs text-gray-500">Sélectionner un fichier</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          PNG, JPG, GIF jusqu'à {maxSizeMB}MB (maximum {maxImages} images)
        </p>
        {uploading && (
          <div className="mt-2">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
            </div>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple
          className="hidden"
          onChange={(e) => {
            handleFileSelect(e.target.files);
            // Reset input to allow selecting the same file again
            if (e.target) {
              (e.target as HTMLInputElement).value = '';
            }
          }}
          disabled={uploading}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept={accept}
          capture="environment"
          className="hidden"
          onChange={(e) => {
            handleFileSelect(e.target.files);
            // Reset input to allow selecting the same file again
            if (e.target) {
              (e.target as HTMLInputElement).value = '';
            }
          }}
          disabled={uploading}
        />
      </div>

      {/* معرض الصور */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((image) => (
            <div
              key={image.id}
              className="relative group border border-gray-300 rounded-lg overflow-hidden bg-white"
            >
              <div className="aspect-square relative">
                <Image
                  src={image.url}
                  alt={image.name}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(image.id);
                }}
                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-2 truncate">
                {image.name}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

