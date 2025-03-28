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
      // Usar los alias si las propiedades principales no están disponibles
      const effectiveArtist = artist || artistName || '';
      const effectiveTitle = title || trackTitle || '';

      // Si ya tenemos un track completo con cover, verificar que no sea de Last.fm
      if (track?.cover && track.cover !== 'placeholder' && !isLastFmPlaceholder(track.cover)) {
        setImageUrl(track.cover);
        setIsLoading(false);
        return;
      }
      
      // NUEVO: Si tenemos un género específico, usar directamente la imagen de género
      // en lugar de esperar que falle la búsqueda
      if (genre && genreBackgrounds[genre.toLowerCase()]) {
        const genreImageUrl = genreBackgrounds[genre.toLowerCase()];
        console.log(`[GenreImage] Usando imagen directa para género: ${genre}`);
        setImageUrl(genreImageUrl);
        setIsLoading(false);
        return;
      }

      // Determinar si estamos en la sección "explore"
      const isExplore = pathname?.includes('/explore');
      
      // Para explore, intentar buscar desde el track-image-service directamente
      if (effectiveTitle && effectiveArtist) {
        try {
          // Intentar primero obtener de caché o servicio de imágenes con preferencia Spotify
          const cachedDetails = await getTrackImageFromCache(`${effectiveArtist}:${effectiveTitle}`);
          
          if (cachedDetails && cachedDetails.cover && !isLastFmPlaceholder(cachedDetails.cover)) {
            setImageUrl(cachedDetails.cover);
            setIsLoading(false);
            return;
          }
          
          // Si no está en caché, buscar directamente con preferencia por Spotify
          const foundDetails = await findTrackImage(effectiveArtist, effectiveTitle, { preferSpotify: true });
          
          if (foundDetails && foundDetails.cover && !isLastFmPlaceholder(foundDetails.cover)) {
            setImageUrl(foundDetails.cover);
            setIsLoading(false);
            return;
          }
        } catch (err) {
          console.log('Error buscando imagen directamente:', err);
        }
      }

      // NUEVO: Si llegamos aquí, intentar extraer posible género del artista
      if (effectiveArtist) {
        const artistLower = effectiveArtist.toLowerCase();
        const possibleGenres = Object.keys(genreBackgrounds).filter(g => 
          g !== 'default' && artistLower.includes(g)
        );
        
        if (possibleGenres.length > 0) {
          const detectedGenre = possibleGenres[0];
          console.log(`[GenreImage] Género detectado a partir del artista "${effectiveArtist}": ${detectedGenre}`);
          setImageUrl(genreBackgrounds[detectedGenre]);
          setIsLoading(false);
          return;
        }
      }

      // Crear un objeto track para pasar al orquestador
      const trackToEnhance: Track = track || {
        id: `${effectiveTitle}-${effectiveArtist}`,
        title: effectiveTitle,
        artist: effectiveArtist || genre || '',
        album: '',
        cover: '',
        albumCover: '',
        duration: 0
      };
      
      // Encolar la carga de datos con el orquestador
      loadOrchestrator.enqueueLoad(
        [trackToEnhance], 
        { 
          page: pageType, 
          section: 'paraTi', // SIEMPRE usar paraTi para forzar 100% Spotify
          isVisible: true,
          completeImages: true,
          preferSpotify: true // SIEMPRE preferir Spotify
        },
        (enhancedTracks) => {
          if (enhancedTracks.length > 0 && enhancedTracks[0].cover && !isLastFmPlaceholder(enhancedTracks[0].cover)) {
            setImageUrl(enhancedTracks[0].cover);
            setIsLoading(false);
          } else {
            // Si todo falló, usar imagen de género genérica pero NO mostrar error
            const genreName = genre?.toLowerCase() || '';
            
            // Buscar imagen directa para el género, o usar default
            const genericImage = genreBackgrounds[genreName] || genreBackgrounds.default;
            setImageUrl(genericImage);
            setIsLoading(false);
          }
        }
      );
    } catch (err) {
      console.error('Error cargando imagen:', err);
      
      // Incluso en caso de error, mostrar una imagen de género
      const genreName = genre?.toLowerCase() || '';
      const fallbackImage = genreBackgrounds[genreName] || genreBackgrounds.default;
      setImageUrl(fallbackImage);
      setIsLoading(false);
      setError(false); // No mostrar error visual
    }
  };

  // Determinar el color de fondo para fallback según el género
  const genreName = genre?.toLowerCase() || '';
  const fallbackColor = genreColors[genreName] || getRandomGenreColor(genreName);
  
  return (
    <Box
      ref={imageRef}
      className={className}
      sx={{
        width: width,
        height: height,
        position: 'relative',
        borderRadius: '8px',
        overflow: 'hidden',
        backgroundColor: error || (!imageUrl && isLoading) ? fallbackColor : 'transparent',
      }}
    >
      {imageUrl && !error ? (
        <Image
          src={imageUrl}
          alt={title || artist || genre || 'Genre image'}
          fill
          style={{ objectFit: 'cover' }}
          priority={priority}
          sizes={`${width}px`}
        />
      ) : showFallback ? (
        // Gradiente para fallback
        <Box 
          sx={{
            width: '100%',
            height: '100%',
            background: `linear-gradient(135deg, ${fallbackColor} 0%, rgba(0,0,0,0.5) 100%)`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            textAlign: 'center',
            padding: '10px',
          }}
        >
          {isLoading ? (
            // Indicador de carga
            <Box sx={{ 
              width: '20px', 
              height: '20px', 
              borderRadius: '50%', 
              border: '2px solid rgba(255,255,255,0.3)',
              borderTop: '2px solid white',
              animation: 'spin 1s linear infinite',
              '@keyframes spin': {
                '0%': { transform: 'rotate(0deg)' },
                '100%': { transform: 'rotate(360deg)' }
              }
            }} />
          ) : (
            <>
              <Box sx={{ 
                fontWeight: 'bold',
                fontSize: Math.min(width / 10, 16), 
                textShadow: '0 0 4px rgba(0,0,0,0.7)',
                textTransform: 'capitalize',
                mb: 1
              }}>
                {genre || artist || ''}
              </Box>
              {(width >= 100 && height >= 100) && (
                <Box sx={{ 
                  fontSize: Math.min(width / 15, 12), 
                  opacity: 0.9,
                  textShadow: '0 0 4px rgba(0,0,0,0.7)'
                }}>
                  Imagen representativa
                </Box>
              )}
            </>
          )}
        </Box>
      ) : null}
    </Box>
  );
};

export default GenreImage; 