'use client';

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useState, useMemo, useRef } from 'react';

// Fix missing icons automatically
// We only run this on client side (useEffect) or outside component if window is defined
// Ideally inside useEffect to avoid SSR issues with `window`
const setupIcons = () => {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });
};

interface MapProps {
    pos: { lat: number; lng: number };
    zoom?: number;
    onLocationSelect?: (lat: number, lng: number) => void;
    readonly?: boolean;
}

function LocationMarker({ pos, onSelect, readonly }: { pos: { lat: number; lng: number }; onSelect?: (lat: number, lng: number) => void; readonly?: boolean }) {
    const [position, setPosition] = useState(pos);
    const markerRef = useRef<any>(null);
    const map = useMap();

    // Fix icons on mount
    useEffect(() => {
        setupIcons();
    }, []);

    // Update map view when pos changes externaly
    useEffect(() => {
        setPosition(pos);
        map.setView(pos, map.getZoom());
    }, [pos, map]);

    const eventHandlers = useMemo(
        () => ({
            dragend() {
                const marker = markerRef.current;
                if (marker != null) {
                    const newPos = marker.getLatLng();
                    setPosition(newPos);
                    if (onSelect) onSelect(newPos.lat, newPos.lng);
                }
            },
        }),
        [onSelect]
    );

    return (
        <Marker
            draggable={!readonly}
            eventHandlers={!readonly ? eventHandlers : undefined}
            position={position}
            ref={markerRef}
        >
            <Popup>
                {readonly ? "Position" : "Déplacez ce marqueur pour corriger la position"}
            </Popup>
        </Marker>
    );
}

export default function LeafletMap({ pos, zoom = 15, onLocationSelect, readonly = false }: MapProps) {
    return (
        <MapContainer center={pos} zoom={zoom} style={{ height: '100%', width: '100%', borderRadius: '0.75rem', zIndex: 0 }}>
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <LocationMarker pos={pos} onSelect={onLocationSelect} readonly={readonly} />
        </MapContainer>
    );
}
