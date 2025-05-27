import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Track } from '@/types/types';
import YouTubeThumbnail from './YouTubeThumbnail';
import { useArtistNavigation } from '@/hooks/useArtistNavigation';
import { usePlayer } from '@/contexts/PlayerContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, Typography, Box, IconButton, Menu, MenuItem } from '@mui/material';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import QueueMusicIcon from '@mui/icons-material/QueueMusic';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RadioIcon from '@mui/icons-material/Radio';
import PersonIcon from '@mui/icons-material/Person';
import LaunchIcon from '@mui/icons-material/Launch';
import { useCustomNotifications } from '@/hooks/useCustomNotifications';

// Crear un Set global para almacenar las URLs que ya han intentado cargar
// Esta caché nos ayudará a evitar reintentos constantes para imágenes que fallan
const failedImageCache = new Set<string>();

// En lugar de cargar una imagen externa que genera muchas solicitudes,
// usamos un Data URL simple para el placeholder (gris oscuro)
// Esto evita hacer peticiones HTTP innecesarias
const placeholderDataUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iIzMzMyIvPjwvc3ZnPg==';

export interface UnifiedMusicCardProps {
  // Datos principales
  id: string;
  title: string;
  subtitle?: string; // Artista, propietario, etc.
  coverUrl: string;

  // Metadatos opcionales
  badge?: {
    text: string;
    color: string;
  };
  duration?: number;
  secondaryInfo?: string; // Información adicional como vistas, reproducciones, etc.

  // Opciones de comportamiento
  isPlayable?: boolean;
  linkTo?: string;

  // Indicador de tipo (para mostrar un badge adecuado si no se proporciona uno)
  itemType?: 'track' | 'album' | 'artist' | 'playlist' | 'video';

  // Callbacks - usando tipos más genéricos para aceptar MouseEvent de cualquier elemento
  onPlay?: (e: React.MouseEvent<any>) => void;
  onClick?: (e: React.MouseEvent<any>) => void;
}

/**
 * Componente de tarjeta unificado para mostrar música, playlists, álbumes,
 * artistas y otros elementos con un estilo consistente en toda la aplicación.
 */
const UnifiedMusicCard: React.FC<UnifiedMusicCardProps> = ({
  id,
  title,
  subtitle,
  coverUrl,
  badge,
  duration,
  secondaryInfo,
  isPlayable = true,
  linkTo,
  itemType,
  onPlay,
  onClick
}) => {
  const { navigateToArtist } = useArtistNavigation();
  // Usar el contexto del reproductor
  const { addToQueue, playTrack, createAutoPlaylist } = usePlayer();
  const { musicNotifications } = useCustomNotifications();

  // Estados para el menú contextual
  const [contextMenuVisible, setContextMenuVisible] = useState<boolean>(false);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  // Estado para controlar la carga de la imagen
  const [imgSrc, setImgSrc] = useState<string>(
    // Si la URL ya falló antes o es inválida, usar directamente el placeholder
    !coverUrl || coverUrl === '' || failedImageCache.has(coverUrl)
      ? placeholderDataUrl
      : coverUrl
  );
  const [imgError, setImgError] = useState<boolean>(false);

  // Efecto para manejar cambios en coverUrl
  useEffect(() => {
    if (coverUrl && coverUrl !== '' && !failedImageCache.has(coverUrl)) {
      setImgSrc(coverUrl);
      setImgError(false);
    } else {
      setImgSrc(placeholderDataUrl);
    }
  }, [coverUrl]);

  // Función para manejar errores de carga de imagen
  const handleImageError = () => {
    // Agregar a caché de fallos para no reintentar
    if (coverUrl && coverUrl !== placeholderDataUrl) {
      failedImageCache.add(coverUrl);
    }
    // Solo cambiar la imagen si no se ha cambiado ya
    if (imgSrc !== placeholderDataUrl) {
      setImgSrc(placeholderDataUrl);
      setImgError(true);
    }
  };

  // Generamos un badge automático basado en el tipo si no se proporciona uno
  const determineBadge = () => {
    if (badge) return badge;

    if (itemType) {
      switch(itemType) {
        case 'track':
          return { text: 'Single', color: 'bg-purple-600' };
        case 'album':
          return { text: 'Álbum', color: 'bg-blue-600' };
        case 'artist':
          return { text: 'Artista', color: 'bg-red-600' };
        case 'playlist':
          return { text: 'Playlist', color: 'bg-green-600' };
        case 'video':
          return { text: 'Video', color: 'bg-red-600' };
      }
    }

    return undefined;
  };

  const displayBadge = determineBadge();

  // Formatear duración de segundos a minutos:segundos
  const formatDuration = (seconds: number): string => {
    if (!seconds) return '--:--';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Determinar qué función manejar en clic
  const handleClick = (e: React.MouseEvent<any>) => {
    // Si es una tarjeta de artista, usar nuestra navegación inteligente
    if (itemType === 'artist') {
      e.preventDefault();
      e.stopPropagation();
      console.log(`[UnifiedMusicCard] Clic en tarjeta de artista: ${title} (${id})`);

      navigateToArtist(id, title, {
        redirigirABusqueda: true,
        mostrarDetalles: true,
        usarNavegacionDirecta: true,  // Usar navegación directa para mayor fiabilidad
        urlFallback: '/home'  // Si todo falla, ir a la página principal
      }).then(result => {
        console.log(`[UnifiedMusicCard] Resultado de navegación a artista:`, result);
        if (!result.success) {
          if (result.redirectedToSearch) {
            console.log(`[UnifiedMusicCard] Redirigido a búsqueda para: ${title}`);
          } else if (result.fallbackUsed) {
            console.log(`[UnifiedMusicCard] Usada URL de fallback`);
          }
        }
      }).catch(err => {
        console.error(`[UnifiedMusicCard] Error en navegación de artista:`, err);
      });

      return;
    }

    if (onClick) {
      onClick(e);
    }
  };

  // Manejar reproducción con mejor manejo de errores y logging
  const handlePlay = (e: React.MouseEvent<any>) => {
    e.stopPropagation();
    e.preventDefault(); // Prevenir navegación si es un enlace
    console.log(`[UnifiedMusicCard] Click en botón reproducir: ${title}`);

    // Intentar usar onPlay si existe, de lo contrario usar onClick como fallback
    try {
      if (onPlay) {
        console.log(`[UnifiedMusicCard] Ejecutando onPlay para: ${title}`);
        onPlay(e);
      } else if (onClick) {
        console.log(`[UnifiedMusicCard] Usando onClick como fallback para reproducción: ${title}`);
        onClick(e);
      }

      // Después de un breve retraso, disparar un evento para generar la playlist automáticamente
      setTimeout(() => {
        try {
          // Crear un objeto básico con información mínima de la pista
          const trackInfo = {
            title,
            subtitle,
            id,
            // Si es una canción de YouTube, podemos enviar el ID directamente
            youtubeId: itemType === 'track' && id.length >= 11 && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : undefined
          };

          // Disparar un evento personalizado para solicitar la creación de playlist
          const event = new CustomEvent('createPlaylist', { detail: trackInfo });
          window.dispatchEvent(event);
          console.log(`[UnifiedMusicCard] Evento createPlaylist disparado para: ${title}`);
        } catch (playlistError) {
          console.error(`[UnifiedMusicCard] Error al solicitar creación de playlist: ${playlistError}`);
        }
      }, 1500); // Dar tiempo suficiente para que se inicie la reproducción
    } catch (error) {
      console.error(`[UnifiedMusicCard] Error al reproducir ${title}:`, error);
    }
  };

  // Detectar si es una URL de YouTube o una URL de imagen de Google/YouTube
  const isYouTubeUrl = coverUrl && typeof coverUrl === 'string' && (
    coverUrl.includes('ytimg.com/vi/') ||
    coverUrl.includes('youtube.com/') ||
    coverUrl.includes('youtu.be/') ||
    coverUrl.includes('googleusercontent.com') ||
    coverUrl.includes('lh3.googleusercontent.com') ||
    coverUrl.includes('ggpht.com')
  );

  // Detectar si es una URL de Spotify
  const isSpotifyUrl = coverUrl && typeof coverUrl === 'string' && (
    coverUrl.includes('i.scdn.co/') ||
    coverUrl.includes('scdn.co/')
  );

  // Extraer ID de vídeo de YouTube si es una URL de YouTube o pasar la URL directa
  const extractYouTubeId = (url: string): string => {
    // Log para depuración
    console.log(`[UnifiedMusicCard] Procesando URL: ${url}`);

    // Casos especiales: URLs de Google
    if (!url || typeof url !== 'string') {
      console.warn('[UnifiedMusicCard] URL inválida:', url);
      return 'default';
    }

    // Si es una URL de Google Cloud Storage (para imágenes de YouTube Music)
    if (url.includes('googleusercontent.com') || url.includes('ggpht.com')) {
      console.log('[UnifiedMusicCard] Detectada URL de Google, utilizando como imagen directa');
      return url;
    }

    // Si es una URL de Spotify, detectarla explícitamente
    if (url.includes('i.scdn.co/') || url.includes('scdn.co/')) {
      console.log('[UnifiedMusicCard] Detectada URL de Spotify, no se procesará como YouTube:', url);
      return 'spotify_url';
    }

    // Si es una URL de imagen directa (jpg, png, etc.), devolverla como está
    if (url.startsWith('http') && (
        url.includes('.jpg') ||
        url.includes('.jpeg') ||
        url.includes('.png') ||
        url.includes('.webp'))) {
      console.log('[UnifiedMusicCard] Detectada URL de imagen directa:', url);
      return url;
    }

    // Si es una URL de YouTube Image con el ID incluido
    if (url.includes('ytimg.com/vi/')) {
      const match = url.match(/ytimg\.com\/vi\/([^\/\?&"]+)/i);
      if (match && match[1] && match[1] !== 'default' && match[1].length > 5) {
        console.log('[UnifiedMusicCard] ID extraído de ytimg:', match[1]);
        return match[1];
      }
    }

    // Patrones comunes de URLs de YouTube para extraer el ID
    const patterns = [
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i,
      /ytimg\.com\/vi\/([^\/\?&"]+)/i
    ];

    // Intentar extraer el ID con los patrones
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1] && match[1] !== 'default' && match[1].length > 5) {
        console.log('[UnifiedMusicCard] ID extraído con patrón:', match[1]);
        return match[1];
      }
    }

    // Último recurso: Si parece ser un ID de YouTube directo (11 caracteres, caracteres válidos)
    if (url.length === 11 && /^[a-zA-Z0-9_-]+$/.test(url)) {
      console.log('[UnifiedMusicCard] URL parece ser un ID de YouTube directo:', url);
      return url;
    }

    console.warn('[UnifiedMusicCard] No se pudo extraer ID o URL válida:', url);
    return 'default'; // Valor de fallback
  };

  // Función para abrir el menú contextual
  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuVisible(true);
  };

  // Función para cerrar el menú contextual
  const handleCloseContextMenu = () => {
    setContextMenuVisible(false);
  };

  // Efecto para escuchar clics fuera del menú para cerrarlo
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenuVisible) {
        handleCloseContextMenu();
      }
    };

    // Manejador para cerrar el menú al hacer scroll
    const handleScroll = () => {
      if (contextMenuVisible) {
        handleCloseContextMenu();
      }
    };

    document.addEventListener('click', handleClickOutside);
    document.addEventListener('scroll', handleScroll);

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('scroll', handleScroll);
    };
  }, [contextMenuVisible]);

  // Convertir la track para usar con las funciones del player
  const getTrackForPlayer = (): Track => {
    return {
      id,
      title,
      artist: subtitle || '',
      album: secondaryInfo || '',
      cover: coverUrl,
      duration: duration || 0,
      youtubeId: id.length === 11 ? id : undefined,
      spotifyId: id.length === 22 ? id : undefined
    };
  };

  // Manejadores para las acciones del menú contextual
  const handlePlayTrack = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (onPlay) {
      onPlay(event);
    } else if (isPlayable) {
      playTrack(getTrackForPlayer());
    }
    handleCloseContextMenu();
  };

  const handleAddToQueue = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (isPlayable && id) {
      addToQueue(getTrackForPlayer());
      musicNotifications.onTrackAdded(title);
    }
    handleCloseContextMenu();
  };

  const handleCreateRadio = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (isPlayable && id) {
      createAutoPlaylist(getTrackForPlayer())
        .then(() => {
          console.log('Radio creada con éxito');
          musicNotifications.onRadioStart(title);
        })
        .catch(err => console.error('Error al crear radio:', err));
    }
    handleCloseContextMenu();
  };

  const handleGoToArtist = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (subtitle) {
      navigateToArtist(id, subtitle, {
        redirigirABusqueda: true,
        mostrarDetalles: true,
        usarNavegacionDirecta: true,
        urlFallback: '/home'
      });
    }
    handleCloseContextMenu();
  };

  const handleOpenInSpotify = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (id.length === 22) {
      window.open(`https://open.spotify.com/track/${id}`, '_blank');
    }
    handleCloseContextMenu();
  };

  // Renderizar el contenido de la tarjeta
  const renderCardContent = () => (
    <div
      ref={cardRef}
      className={`
        group relative rounded-md overflow-hidden transition-all duration-300 ease-in-out
        cursor-pointer
        ${isPlayable ? 'hover:shadow-md hover:shadow-purple-500/20' : ''}
      `}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      <div className="p-2 flex flex-col h-full">
        {/* Contenedor de imagen con proporción adecuada al tipo de contenido */}
        <div className={`relative w-full ${!isYouTubeUrl ? 'pb-[100%]' : itemType === 'video' ? 'pb-[56.25%]' : 'pb-[100%]'} overflow-hidden rounded-md mb-1 bg-gray-200 dark:bg-gray-800`}>
          {/* Cover image or YouTube thumbnail */}
          {isYouTubeUrl && !extractYouTubeId(coverUrl).includes('http') ? (
            <YouTubeThumbnail
              videoId={extractYouTubeId(coverUrl)}
              alt={title}
              width={500}
              height={itemType === 'video' ? 281 : 500}
              className="object-cover transition-transform duration-300 group-hover:scale-110"
              aspectRatio={itemType === 'video' ? 'video' : 'square'}
            />
          ) : (
            <Image
              src={imgSrc}
              alt={title}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover transition-transform duration-300 group-hover:scale-110"
              onError={handleImageError}
              loading="lazy"
              placeholder="blur"
              blurDataURL={placeholderDataUrl}
            />
          )}

          {/* Badge de tipo */}
          {displayBadge && (
            <div className={`absolute bottom-1 left-1 px-1.5 py-0.5 text-xs font-medium text-white rounded-full ${displayBadge.color}`}>
              {displayBadge.text}
            </div>
          )}

          {/* Botón de reproducción para elementos reproducibles */}
          {isPlayable && (
            <div
              className="opacity-0 group-hover:opacity-100 absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity duration-300"
              onClick={handlePlay}
            >
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Título con truncamiento en líneas */}
        <h3 className="text-xs md:text-sm font-medium line-clamp-1 mb-0.5 group-hover:text-primary transition-colors">
          {title}
        </h3>

        {/* Subtítulo */}
        {subtitle && (
          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1 mb-0.5">
            {subtitle}
          </p>
        )}

        {/* Línea de información adicional: Duración o vistas */}
        {(duration || secondaryInfo) && (
          <div className="text-xs text-gray-500 dark:text-gray-500 mt-0.5 flex items-center">
            {duration && (
              <span className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatDuration(duration)}
              </span>
            )}

            {secondaryInfo && (
              <span className={`${duration ? 'ml-2' : ''} flex items-center`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                {secondaryInfo}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Menú contextual */}
      <AnimatePresence>
        {contextMenuVisible && (
          <motion.div
            className="fixed z-50 bg-[#0f0f18]/95 backdrop-blur-lg shadow-lg rounded-lg overflow-hidden border border-white/10 w-48 text-white"
            style={{
              top: contextMenuPosition.y,
              left: contextMenuPosition.x,
              position: 'fixed' // Garantizar posición fija independiente del scroll
            }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="py-1">
              <MenuItem onClick={handlePlayTrack} disabled={!isPlayable}>
                <PlayArrowIcon fontSize="small" style={{ marginRight: 8 }} />
                Reproducir
              </MenuItem>
              <MenuItem onClick={handleAddToQueue} disabled={!isPlayable}>
                <QueueMusicIcon fontSize="small" style={{ marginRight: 8 }} />
                Añadir a la cola
              </MenuItem>
              <MenuItem onClick={handleCreateRadio} disabled={!isPlayable}>
                <RadioIcon fontSize="small" style={{ marginRight: 8 }} />
                Crear radio
              </MenuItem>
              <MenuItem onClick={handleGoToArtist}>
                <PersonIcon fontSize="small" style={{ marginRight: 8 }} />
                Ir al artista
              </MenuItem>
              {id.length === 22 && (
                <MenuItem onClick={handleOpenInSpotify}>
                  <LaunchIcon fontSize="small" style={{ marginRight: 8 }} />
                  Abrir en Spotify
                </MenuItem>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  // Si es una tarjeta de artista, manejar la navegación nosotros mismos
  if (itemType === 'artist') {
    return renderCardContent();
  }

  // Si hay un enlace, envolver en un componente Link
  if (linkTo) {
    return (
      <Link href={linkTo}>
        {renderCardContent()}
      </Link>
    );
  }

  // De lo contrario, devolver el contenido directamente
  return renderCardContent();
};

/**
 * Función utilitaria para crear una tarjeta de música a partir de un objeto Track
 */
export const createTrackCard = (track: Track, onPlay?: (track: Track) => void) => {
  // Determinar la URL de la portada adecuada
  let coverToUse = track.cover;

  // Si el track tiene una URL específica de Spotify, usarla directamente
  if (track.source === 'spotify' && track.spotifyCoverUrl) {
    coverToUse = track.spotifyCoverUrl;
    console.log(`[UnifiedMusicCard] Usando URL de Spotify para ${track.title}: ${coverToUse}`);
  }

  return (
    <UnifiedMusicCard
      id={track.id}
      title={track.title}
      subtitle={track.artist}
      coverUrl={coverToUse}
      duration={track.duration ? track.duration / 1000 : undefined}
      itemType="track"
      onPlay={onPlay ? () => onPlay(track) : undefined}
      linkTo={`/track/${track.id}?source=${track.source}`}
    />
  );
};

export default UnifiedMusicCard;
