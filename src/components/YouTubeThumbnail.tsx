import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { ImageResolver } from '@/services/imageResolver';
import { Track } from '@/types/types';

// Tipos de calidad de miniaturas disponibles en YouTube
type ThumbnailQuality = 'maxresdefault' | 'sddefault' | 'hqdefault' | 'mqdefault' | 'default';

interface YouTubeThumbnailProps {
  videoId: string;
  quality?: ThumbnailQuality;
  alt?: string;
  width?: number;
  height?: number;
  className?: string;
  aspectRatio?: 'square' | 'video' | 'custom';
  borderRadius?: string;
  fallbackImage?: string;
  track?: Track; // Opcional: información de la pista para buscar en Spotify si falla
  trackId?: string; // Opcional: ID de la pista para actualización
}

/**
 * Componente para mostrar miniaturas de YouTube con fallback automático
 * Si una calidad de imagen no está disponible, intentará con la siguiente.
 * Si todas fallan, emitirá un evento para buscar en Spotify.
 */
const YouTubeThumbnail: React.FC<YouTubeThumbnailProps> = ({
  videoId,
  quality = 'hqdefault',
  alt = 'YouTube video thumbnail',
  width = 400,
  height = 300,
  className = '',
  aspectRatio = 'video',
  borderRadius = 'rounded-xl',
  fallbackImage = '/placeholder-album.jpg',
  track,
  trackId
}) => {
  const [currentQuality, setCurrentQuality] = useState<string>(quality);
  const [hasError, setHasError] = useState<boolean>(false);
  
  // Validar si el videoId es válido antes de usarlo
  const isValidVideoId = videoId && videoId !== 'default' && videoId.length >= 5;
  
  // Generar un texto alternativo descriptivo para la accesibilidad
  const generateAltText = (): string => {
    if (track) {
      if (track.title && track.artist) {
        return `Portada de "${track.title}" por ${track.artist}`;
      } else if (track.title) {
        return `Portada de "${track.title}"`;
      } else if (track.artist) {
        return `Portada de canción por ${track.artist}`;
      }
    }
    
    // Si no hay información de track, usar alt proporcionado o un valor predeterminado
    return alt || 'Miniatura de video de YouTube';
  };
  
  // Construir URL de la miniatura solo si el videoId es válido
  const getImageUrl = () => {
    if (!isValidVideoId) {
      console.log(`[THUMBNAIL-FRONTEND] Video ID inválido: "${videoId}"`);
      return fallbackImage;
    }
    
    // Limpiar el videoId para evitar problemas
    let cleanVideoId = videoId.trim();
    
    // Verificar si el ID es un URL completo en lugar de un ID
    if (cleanVideoId.includes('http')) {
      console.error(`[THUMBNAIL-FRONTEND] El Video ID parece ser una URL completa: "${cleanVideoId}"`);
      
      // Intentar extraer el ID de una URL de YouTube
      const extractYouTubeId = (url: string): string => {
        // Patrones para diferentes formatos de URL de YouTube
        const patterns = [
          // YouTube image URL (img.youtube.com)
          /https:\/\/img\.youtube\.com\/vi\/([a-zA-Z0-9_-]{11})\/[^\/]+\.jpg/i,
          // YouTube image URL (i.ytimg.com)
          /https:\/\/i\.ytimg\.com\/vi\/([a-zA-Z0-9_-]{11})\/[^\/]+\.jpg/i,
          // URL duplicada (detecta patrón de duplicación)
          /https:\/\/img\.youtube\.com\/vi\/https:\/\/img\.youtube\.com\/vi\/([a-zA-Z0-9_-]{11})/i,
          /https:\/\/img\.youtube\.com\/vi\/https:\/\/i\.ytimg\.com\/vi\/([a-zA-Z0-9_-]{11})/i
        ];
        
        for (const pattern of patterns) {
          const match = url.match(pattern);
          if (match && match[1]) {
            console.log(`[THUMBNAIL-FRONTEND] ID extraído de URL: ${match[1]}`);
            return match[1];
          }
        }
        
        return '';
      };
      
      // Intentar extraer el ID de la URL
      const extractedId = extractYouTubeId(cleanVideoId);
      if (extractedId) {
        cleanVideoId = extractedId;
      } else {
        // Si no podemos extraer el ID, usar la imagen de fallback
        return fallbackImage;
      }
    }
    
    const url = `https://img.youtube.com/vi/${cleanVideoId}/${currentQuality}.jpg`;
    console.log(`[THUMBNAIL-FRONTEND] Construyendo URL para ID "${cleanVideoId}": ${url}`);
    return url;
  };
  
  // Función para manejar errores de carga de imagen
  const handleImageError = () => {
    console.log(`[THUMBNAIL-FRONTEND] Error al cargar imagen con calidad: ${currentQuality} para videoId: ${videoId}`);
    
    // Verificar si hay problemas con el videoId
    if (videoId.includes('http') || videoId.includes('.jpg')) {
      console.error(`[THUMBNAIL-FRONTEND] Video ID con formato incorrecto: ${videoId}`);
      setHasError(true);
      return;
    }
    
    // Si la calidad actual falló y no es la calidad por defecto, intentar con una calidad inferior
    if (currentQuality === 'maxresdefault') {
      console.log('[THUMBNAIL-FRONTEND] Cambiando a hqdefault');
      setCurrentQuality('hqdefault');
    } else if (currentQuality === 'hqdefault') {
      console.log('[THUMBNAIL-FRONTEND] Cambiando a mqdefault');
      setCurrentQuality('mqdefault');
    } else if (currentQuality === 'mqdefault') {
      console.log('[THUMBNAIL-FRONTEND] Cambiando a default');
      setCurrentQuality('default');
    } else {
      // Si llegamos aquí, todas las calidades han fallado
      console.log('[THUMBNAIL-FRONTEND] Todas las calidades fallaron. Usando imagen de respaldo.');
      setHasError(true);
    }
  };
  
  // Si hay un error o no hay videoId válido, mostrar imagen de fallback
  if (hasError || !isValidVideoId) {
    console.log(`[THUMBNAIL-FRONTEND] Mostrando imagen de fallback para ID: "${videoId}"`);
    return (
      <div className={`relative overflow-hidden ${aspectRatio === 'video' ? 'aspect-video' : aspectRatio === 'square' ? 'aspect-square' : ''} ${borderRadius} ${className}`}
           data-track-id={trackId}>
        <div className="placeholder-album w-full h-full bg-gray-800 flex items-center justify-center flex-col p-2">
          {track?.artist && (
            <span className="text-xs text-gray-400 text-center line-clamp-1">
              {track.artist}
            </span>
          )}
          {track?.title && (
            <span className="text-sm text-white text-center mt-1 line-clamp-2">
              {track.title}
            </span>
          )}
          {!track?.title && (
            <span className="text-sm text-gray-400">
              Imagen no disponible
            </span>
          )}
        </div>
      </div>
    );
  }
  
  // Asegurar siempre tener una URL válida para src
  const thumbnailUrl = getImageUrl();
  const accessibleAltText = generateAltText();
  
  return (
    <div className={`relative overflow-hidden ${aspectRatio === 'video' ? 'aspect-video' : aspectRatio === 'square' ? 'aspect-square' : ''} ${borderRadius} ${className}`}
         data-track-id={trackId}>
      <Image 
        src={thumbnailUrl}
        alt={accessibleAltText}
        width={width}
        height={height}
        className={`w-full h-full object-cover`}
        onError={handleImageError}
        priority={true}
        unoptimized={true}
      />
    </div>
  );
};

export default YouTubeThumbnail; 