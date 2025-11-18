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
        // Vérifier le type de fichier
        if (!file.type.startsWith('image/')) {
          toast.error(`Le fichier ${file.name} n'est pas une image`);
          continue;
        }

        // Vérifier la taille du fichier
        if (file.size > maxSizeBytes) {
          toast.error(`La taille de l'image ${file.name} dépasse ${maxSizeMB}MB`);
          continue;
        }

        // Uploader l'image vers Cloudinary
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', folder);

        const response = await fetch('/api/upload/cloudinary', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const result = await response.json();
          const newImage: ImageData = {
            id: result.image.id || `${Date.now()}-${Math.random()}`,
            name: result.image.name || file.name,
            url: result.image.url,
            publicId: result.image.publicId,
            type: result.image.type || file.type,
            size: result.image.size || file.size,
            width: result.image.width,
            height: result.image.height,
            format: result.image.format,
          };
          newImages.push(newImage);
        } else {
          const error = await response.json();
          toast.error(`Erreur lors de l'upload de ${file.name}: ${error.error || 'Erreur inconnue'}`);
        }
      }

      // Ajouter les images uploadées avec succès à la liste
      if (newImages.length > 0) {
        onChange([...images, ...newImages]);
        toast.success(`${newImages.length} image(s) uploadée(s) avec succès`);
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
          onChange={(e) => handleFileSelect(e.target.files)}
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

