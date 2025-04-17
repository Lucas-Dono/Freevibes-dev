import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Track } from '@/types/types';

interface HybridMusicCardProps {
  track: Track;
  onPlay?: (track: Track) => void;
}

/**
 * Componente para mostrar una tarjeta de pista musical del sistema híbrido
 * con estilo unificado basado en el diseño de explore
 */
const HybridMusicCard: React.FC<HybridMusicCardProps> = ({ track, onPlay }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Valores por defecto para cuando faltan datos
  const title = track.title || 'Título no disponible';
  const artist = track.artist || 'Artista desconocido';
  const fallbackCover = 'https://placehold.co/300x300/2b2b2b/FFFFFF?text=No+Image';
  const coverUrl = (track.cover && !imageError) ? track.cover : fallbackCover;
  const source = track.source || 'desconocido';
  
  // Formatear duración de segundos a minutos:segundos
  const formatDuration = (seconds: number): string => {
    if (!seconds) return '--:--';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Manejador para el botón de reproducción
  const handlePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('Reproduciendo track:', track);
    
    if (onPlay && track) {
      // Asegurarse de que la pista tenga un id válido
      if (!track.id && track.youtubeId) {
        const trackWithId = {
          ...track,
          id: track.youtubeId
        };
        onPlay(trackWithId);
      } else {
        onPlay(track);
      }
    }
  };

  // Manejar errores de carga de imagen
  const handleImageError = () => {
    setImageError(true);
  };

  return (
    <div 
      className="group relative bg-card hover:bg-card/80 transition-all duration-300 rounded-lg overflow-hidden cursor-pointer shadow-md hover:shadow-lg hover:scale-105 transform hover:border border-purple-500/20"
      onClick={handlePlay}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label={`Reproducir ${title} de ${artist}`}
    >
      <div className="aspect-square w-full relative">
        {/* Badge de la fuente */}
        <div className={`absolute top-2 left-2 z-10 px-1.5 py-0.5 text-xs rounded-sm ${
          source === 'spotify' ? 'bg-green-600' : 'bg-red-600'
        } text-white font-medium opacity-80`}>
          {source === 'spotify' ? 'Spotify' : 'YT'}
        </div>
        
        {/* Duración */}
        <div className="absolute bottom-2 right-2 z-10 px-1.5 py-0.5 text-xs rounded-sm bg-black/70 text-white">
          {formatDuration(track.duration || 0)}
        </div>
        
        {/* Portada */}
        <Image 
          src={coverUrl}
          alt={`${title} por ${artist}`}
          width={400}
          height={400}
          className="w-full h-full absolute inset-0 object-cover transition-transform duration-500 group-hover:scale-110"
          onError={handleImageError}
        />
        
        {/* Gradiente para texto */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-70 group-hover:opacity-90 flex items-end justify-start transition-opacity duration-300">
          <div className="p-3 w-full">
            <h3 className="text-white text-base font-semibold line-clamp-1 drop-shadow-md">
              {title}
            </h3>
            <p className="text-gray-300 text-sm line-clamp-1">
              {artist}
            </p>
          </div>
        </div>
        
        {/* Mensaje al pasar el cursor */}
        <div className={`absolute inset-0 bg-black/60 flex flex-col items-center justify-center transition-opacity duration-300 ${
          isHovered ? 'opacity-100' : 'opacity-0'
        }`}>
          <div className="bg-white/90 rounded-full p-3 transform hover:scale-110 transition-transform duration-300 shadow-md">
            <svg className="h-8 w-8 text-black fill-current" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <p className="text-white mt-2 font-medium text-center px-2">Reproducir ahora</p>
        </div>
      </div>
    </div>
  );
};

export default HybridMusicCard; 