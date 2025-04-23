'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { getYoutubeThumbnail, handleYoutubeThumbnailError } from '@/lib/utils';

interface YouTubeThumbnailProps {
  videoId: string;
  quality?: 'max' | 'hq' | 'mq' | 'sd';
  alt?: string;
  width?: number;
  height?: number;
  className?: string;
  aspectRatio?: 'square' | '16/9' | '4/3';
  borderRadius?: string;
  priority?: boolean;
}

const YouTubeThumbnail: React.FC<YouTubeThumbnailProps> = ({
  videoId,
  quality = 'max',
  alt = 'Miniatura de YouTube',
  width = 300,
  height = 180,
  className = '',
  aspectRatio = '16/9',
  borderRadius = '8px',
  priority = false
}) => {
  // Validar el videoId antes de crear la URL
  const validVideoId = videoId && videoId !== 'default' && videoId.length >= 5 ? videoId : null;

  // Usar un placeholder si el videoId no es válido
  const initialSrc = validVideoId ? getYoutubeThumbnail(validVideoId, quality) : '/placeholder-album.jpg';

  const [imgSrc, setImgSrc] = useState<string>(initialSrc);
  const [hasError, setHasError] = useState<boolean>(!validVideoId);

  useEffect(() => {
    if (!validVideoId) {
      setImgSrc('/placeholder-album.jpg');
      setHasError(true);
      return;
    }

    // Actualizar la fuente si cambia el videoId o la calidad
    const newSrc = getYoutubeThumbnail(validVideoId, quality);
    console.log(`[UI-THUMBNAIL] Actualizando imagen para ID "${validVideoId}": ${newSrc}`);
    setImgSrc(newSrc);
    setHasError(false);
  }, [validVideoId, quality]);

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (!validVideoId) {
      setHasError(true);
      return;
    }

    console.log(`[UI-THUMBNAIL] Error al cargar imagen para ID "${validVideoId}"`);

    // Usar el manejador para probar diferentes formatos
    const newSrc = handleYoutubeThumbnailError(e, validVideoId);
    if (newSrc) {
      setImgSrc(newSrc);
    } else {
      setHasError(true);
    }
  };

  // Calcular proporciones basadas en el aspect ratio
  let calculatedHeight = height;
  if (aspectRatio === 'square') {
    calculatedHeight = width;
  } else if (aspectRatio === '16/9') {
    calculatedHeight = Math.round(width * 9 / 16);
  } else if (aspectRatio === '4/3') {
    calculatedHeight = Math.round(width * 3 / 4);
  }

  // Si hay error o el videoId no es válido, mostrar placeholder
  if (hasError || !validVideoId) {
    console.log(`[UI-THUMBNAIL] Mostrando placeholder para ID: "${videoId}"`);
    return (
      <div
        className={`youtube-thumbnail-container ${className}`}
        style={{
          position: 'relative',
          width: `${width}px`,
          height: `${calculatedHeight}px`,
          borderRadius,
          overflow: 'hidden',
          backgroundColor: '#1e293b'
        }}
      >
        <div className="placeholder-content" style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#94a3b8',
          fontSize: '12px'
        }}>
          <span>Imagen no disponible</span>
        </div>
      </div>
    );
  }

  // Usar el elemento Image de Next.js con manejo de errores
  return (
    <div
      className={`youtube-thumbnail-container ${className}`}
      style={{
        position: 'relative',
        width: `${width}px`,
        height: `${calculatedHeight}px`,
        borderRadius,
        overflow: 'hidden'
      }}
    >
      <Image
        src={imgSrc}
        alt={alt}
        fill
        style={{ objectFit: 'cover' }}
        onError={handleError}
        priority={priority}
        unoptimized={true}
      />

      {/* Icono de YouTube en la esquina */}
      <div className="youtube-icon" style={{
        position: 'absolute',
        bottom: '8px',
        right: '8px',
        padding: '3px 5px',
        backgroundColor: 'rgba(0,0,0,0.7)',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        gap: '3px',
        fontSize: '10px',
        color: 'white'
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="red">
          <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
        <span>YouTube</span>
      </div>
    </div>
  );
};

export default YouTubeThumbnail;
