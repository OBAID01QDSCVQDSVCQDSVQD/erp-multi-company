'use client';

import { useState, useEffect } from 'react';

interface GoogleMapPickerProps {
    initialLat?: number;
    initialLng?: number;
    onLocationChange?: (lat: number, lng: number) => void;
    readonly?: boolean;
    height?: string;
}

export default function GoogleMapPicker({
    initialLat = 36.8065,
    initialLng = 10.1815,
    onLocationChange,
    readonly = false,
    height = '100%'
}: GoogleMapPickerProps) {
    const [position, setPosition] = useState({ lat: initialLat, lng: initialLng });
    const [mapLoaded, setMapLoaded] = useState(false);

    useEffect(() => {
        setPosition({ lat: initialLat, lng: initialLng });
    }, [initialLat, initialLng]);

    const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (readonly) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Calculate approximate lat/lng based on click position
        // This is a simplified calculation - for production use Google Maps API
        const latOffset = (y - rect.height / 2) / rect.height * 0.01;
        const lngOffset = (x - rect.width / 2) / rect.width * 0.01;

        const newLat = position.lat - latOffset;
        const newLng = position.lng + lngOffset;

        setPosition({ lat: newLat, lng: newLng });
        if (onLocationChange) {
            onLocationChange(newLat, newLng);
        }
    };

    const mapUrl = `https://www.google.com/maps?q=${position.lat},${position.lng}&output=embed`;

    return (
        <div className="relative w-full" style={{ height }}>
            <iframe
                src={mapUrl}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                onLoad={() => setMapLoaded(true)}
                className="rounded-lg"
            />

            {!readonly && (
                <div
                    className="absolute inset-0 cursor-crosshair z-10"
                    onClick={handleMapClick}
                    title="Cliquez pour placer le marqueur"
                />
            )}

            <div className="absolute bottom-2 left-2 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-lg text-xs font-mono z-20 border border-gray-200 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400">Lat:</span>{' '}
                <span className="font-semibold text-gray-900 dark:text-white">{position.lat.toFixed(6)}</span>
                {' | '}
                <span className="text-gray-600 dark:text-gray-400">Lng:</span>{' '}
                <span className="font-semibold text-gray-900 dark:text-white">{position.lng.toFixed(6)}</span>
            </div>

            {!mapLoaded && (
                <div className="absolute inset-0 bg-gray-100 dark:bg-gray-800 flex items-center justify-center rounded-lg">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Chargement de la carte...</p>
                    </div>
                </div>
            )}
        </div>
    );
}
