'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { loadOrchestrator } from '@/services/orchestration';
import { getPageTypeFromPath, asSectionType } from '@/lib/navigation-map';
import { Track } from '@/types/types';
import { Box } from '@mui/material';
import { getTrackImageFromCache } from '@/lib/image-cache';
import { findTrackImage } from '@/lib/track-image-service';

// Imágenes predefinidas para géneros musicales
const genreBackgrounds: Record<string, string> = {
  'pop': 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819',
  'rock': 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee',
  'hip-hop': 'https://images.unsplash.com/photo-1601643157091-ce5c665179ab',
  'electronic': 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745',
  'jazz': 'https://images.unsplash.com/photo-1511192336575-5a79af67a629',
  'r&b': 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f',
  'latin': 'https://images.unsplash.com/photo-1535324492437-d8dea70a38a7',
  'classical': 'https://images.unsplash.com/photo-1507838153414-b4b713384a76',
  'indie': 'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b',
  'alternative': 'https://images.unsplash.com/photo-1571330735066-03aaa9429d89',
  'metal': 'https://images.unsplash.com/photo-1629276301820-0f3eedc29fd0',
  'soul': 'https://images.unsplash.com/photo-1605722625766-a4c989c747a4',
  'blues': 'https://images.unsplash.com/photo-1601312378427-822b2b41da35',
  'punk': 'https://images.unsplash.com/photo-1598387993281-cecf8b71a8f8',
  'reggae': 'https://images.unsplash.com/photo-1540039628-1432a508c3fd',
  'country': 'https://images.unsplash.com/photo-1581290723777-fd2c6fba9b44',
  'folk': 'https://images.unsplash.com/photo-1499364615650-ec38552f4f34',
  'default': 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4',
};

// Colores para géneros (en caso de que no se encuentre una imagen)
const genreColors: Record<string, string> = {
  'pop': '#FF1493', // Rosa intenso
  'rock': '#8B0000', // Rojo oscuro
  'hip-hop': '#4B0082', // Índigo
  'electronic': '#00CED1', // Turquesa medio
  'jazz': '#8B4513', // Marrón
  'r&b': '#4682B4', // Azul acero
  'latin': '#FF8C00', // Naranja oscuro
  'classical': '#B8860B', // Dorado oscuro
  'indie': '#2F4F4F', // Verde pizarra oscuro
  'metal': '#000000', // Negro
  'alternative': '#483D8B', // Azul pizarra oscuro
  'default': '#6A5ACD', // Azul pizarra
};

// Función para obtener un color aleatorio pero consistente para géneros no mapeados
const getRandomGenreColor = (genre: string): string => {
  if (!genre) return genreColors.default;
  
  // Generar un hash simple del nombre del género
  let hash = 0;
  for (let i = 0; i < genre.length; i++) {
    hash = genre.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Colorear en el rango de los colores existentes
  const allColors = Object.values(genreColors);
  const colorIndex = Math.abs(hash) % allColors.length;
  return allColors[colorIndex];
};

interface GenreImageProps {
  genre?: string;
  track?: Track;
  artist?: string;
  title?: string;
  artistName?: string; // Alias para artist
  trackTitle?: string; // Alias para title
  index?: number; // Posición del elemento en la lista
  width?: number;
  height?: number;
  priority?: boolean;
  className?: string;
  showFallback?: boolean;
  size?: string; // Tamaño predefinido (small, medium, large)
}

const GenreImage = ({ 
  genre, 
  track, 
  artist, 
  title, 
  artistName, 
  trackTitle,
  index = 0,
  width = 200, 
  height = 200, 
  priority = false,
  className,
  showFallback = true,
  size
}: GenreImageProps) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const imageRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Obtener información de sección actual
  const pageType = getPageTypeFromPath(pathname || '/');
  const sectionType = asSectionType(genre || 'otros');

  useEffect(() => {
    // Configurar observer para detectar cuando la imagen es visible
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadImageData();
          // Desconectar después de cargar
          if (observerRef.current && imageRef.current) {
            observerRef.current.unobserve(imageRef.current);
          }
        }
      },
      { threshold: 0.1 } // 10% visible triggers loading
    );

    if (imageRef.current) {
      observerRef.current.observe(imageRef.current);
    }

    return () => {
      if (observerRef.current && imageRef.current) {
        observerRef.current.unobserve(imageRef.current);
      }
    };
  }, [track, artist, title, genre, artistName, trackTitle]);

  // Función para detectar placeholders de Last.fm
  const isLastFmPlaceholder = (url: string): boolean => {
    if (!url) return false;
    
    const lastfmIndicators = [
      '2a96cbd8b46e442fc41c2b86b821562f', // ID común de placeholder de Last.fm (estrella)
      'lastfm.freetls.fastly.net/i/u/',    // URLs de Last.fm para placeholders
      'lastfm-img2.akamaized.net/i/u/',    // Otro dominio de Last.fm
      'lastfm.freetls.fastly.net/i/u/ar0/', // Formatos adicionales de Last.fm
      'lastfm-img2.akamaized.net/i/u/ar0/',
      '/174s/', // Tamaño común de placeholder
      '/300x300/', // Otro tamaño común
      '/avatar', // Avatar genérico
      'fb421c35880topadw', // Otro ID de placeholder
      'c6f59c1e5e7240a4c0d427abd71f3dbb', // Otro ID de placeholder conocido
      '4128a6eb29f94943c9d206c08e625904' // Otro ID de placeholder conocido
    ];
    
    return lastfmIndicators.some(indicator => url.includes(indicator));
  };

  const loadImageData = async () => {
    setIsLoading(true);
    setError(false);

    try {
      // OPTIMIZACIÓN: Verificar la caché de memoria primero
      const cacheKey = `genre_${genre || ''}_${artist || artistName || ''}_${title || trackTitle || ''}`;
      const cachedImage = sessionStorage.getItem(cacheKey);
      
      if (cachedImage) {
        console.log(`[GenreImage] Usando imagen cacheada para: ${cacheKey}`);
        setImageUrl(cachedImage);
        setIsLoading(false);
        return;
      }

      // Usar los alias si las propiedades principales no están disponibles
      const effectiveArtist = artist || artistName || '';
      const effectiveTitle = title || trackTitle || '';
      const effectiveGenre = genre?.toLowerCase() || '';

      // Si ya tenemos un track completo con cover, verificar que no sea de Last.fm
      if (track?.cover && track.cover !== 'placeholder' && !isLastFmPlaceholder(track.cover)) {
        setImageUrl(track.cover);
        sessionStorage.setItem(cacheKey, track.cover);
        setIsLoading(false);
        return;
      }
      
      // PRIORIDAD 1: Si tenemos un género específico, usar directamente la imagen de género
      if (effectiveGenre && genreBackgrounds[effectiveGenre]) {
        const genreImageUrl = genreBackgrounds[effectiveGenre];
        console.log(`[GenreImage] Usando imagen directa para género: ${effectiveGenre}`);
        setImageUrl(genreImageUrl);
        sessionStorage.setItem(cacheKey, genreImageUrl);
        setIsLoading(false);
        return;
      }

      // PRIORIDAD 2: Para artistas y tracks, usar caché local
      if (effectiveTitle && effectiveArtist) {
        const trackCacheKey = `${effectiveArtist}:${effectiveTitle}`;
        try {
          // Intentar primero obtener de caché con una única solicitud
          const cachedDetails = await getTrackImageFromCache(trackCacheKey);
          
          if (cachedDetails && cachedDetails.cover && !isLastFmPlaceholder(cachedDetails.cover)) {
            setImageUrl(cachedDetails.cover);
            sessionStorage.setItem(cacheKey, cachedDetails.cover);
            setIsLoading(false);
            return;
          }
          
          // No hacer peticiones a APIs externas para imágenes de géneros
          // esto ayuda a reducir la carga y las peticiones innecesarias
          if (effectiveGenre) {
            // Usar un color de género para evitar solicitudes adicionales
            setIsLoading(false);
            setError(true); // Forzar el fallback de color
            return;
          }
          
          // Solo para tracks específicos (no géneros), buscar imágenes
          if (!effectiveGenre && pathname && !pathname.includes('/explore/genres')) {
            // Si no está en caché, buscar directamente con preferencia por Spotify
            // PERO limitamos a páginas relevantes, no de género
            const foundDetails = await findTrackImage(effectiveArtist, effectiveTitle, { preferSpotify: true });
            
            if (foundDetails && foundDetails.cover && !isLastFmPlaceholder(foundDetails.cover)) {
              setImageUrl(foundDetails.cover);
              sessionStorage.setItem(cacheKey, foundDetails.cover);
              setIsLoading(false);
              return;
            }
          }
        } catch (err) {
          console.log('Error buscando imagen directamente:', err);
        }
      }

      // PRIORIDAD 3: Intentar extraer posible género del artista
      if (effectiveArtist) {
        const artistLower = effectiveArtist.toLowerCase();
        const possibleGenres = Object.keys(genreBackgrounds).filter(g => 
          g !== 'default' && artistLower.includes(g)
        );
        
        if (possibleGenres.length > 0) {
          const detectedGenre = possibleGenres[0];
          console.log(`[GenreImage] Género detectado a partir del artista "${effectiveArtist}": ${detectedGenre}`);
          const detectedUrl = genreBackgrounds[detectedGenre];
          setImageUrl(detectedUrl);
          sessionStorage.setItem(cacheKey, detectedUrl);
          setIsLoading(false);
          return;
        }
      }

      // PRIORIDAD 4: Usar fallback de color para evitar solicitudes adicionales
      console.log(`[GenreImage] Usando fallback de color para: ${effectiveGenre || effectiveArtist || effectiveTitle}`);
      setIsLoading(false);
      setError(true); // Esto activará el fallback visual
      
    } catch (err) {
      console.error('Error cargando imagen:', err);
      setIsLoading(false);
      setError(true); // Forzar fallback visual
    }
  };

  return (
    <div 
      ref={imageRef} 
      className={`overflow-hidden w-full h-full relative ${className || ''}`}
      style={{ 
        backgroundColor: error || !imageUrl 
          ? (genre && genreColors[genre.toLowerCase()]) || getRandomGenreColor(genre || '') 
          : undefined,
      }}
    >
      {(imageUrl && !error) ? (
        <Image
          src={imageUrl}
          alt={genre || artist || title || 'Género musical'}
          width={width}
          height={height}
          priority={priority || index < 10}
          className="w-full h-full object-cover"
          style={{ 
            objectFit: 'cover',
            objectPosition: 'center',
            width: '100%',
            height: '100%'
          }}
          onError={() => {
            console.log('Error cargando imagen:', imageUrl);
            setError(true);
          }}
        />
      ) : showFallback ? (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-black">
          <div className="text-center px-2">
            <div className="text-white font-bold uppercase text-lg md:text-xl truncate max-w-full">
              {genre 
                ? genre.charAt(0).toUpperCase() + genre.slice(1) 
                : artist || title || 'Música'}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default GenreImage; 