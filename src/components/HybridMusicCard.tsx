import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Track } from '@/types/types';

interface HybridMusicCardProps {
  track: Track;
  onPlay?: (track: Track) => void;
}

/**
 * Componente para mostrar una tarjeta de pista musical del sistema híbrido
 */
const HybridMusicCard: React.FC<HybridMusicCardProps> = ({ track, onPlay }) => {
  // Valores por defecto para cuando faltan datos
  const title = track.title || 'Título no disponible';
  const artist = track.artist || 'Artista desconocido';
  const coverUrl = track.cover || 'https://placehold.co/300x300/2b2b2b/FFFFFF?text=No+Image';
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
    e.stopPropagation();
    if (onPlay) {
      onPlay(track);
    }
  };

  return (
    <div 
      className="group relative bg-zinc-800/50 hover:bg-zinc-700/50 rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-all duration-300"
      onClick={handlePlay}
    >
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
      <div className="aspect-square relative">
        <Image 
          src={coverUrl}
          alt={`${title} por ${artist}`}
          width={200}
          height={200}
          className="object-cover w-full h-full"
        />
        
        {/* Overlay con botón de reproducción */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
          <div 
            className="bg-white/90 rounded-full p-2.5 transform scale-90 group-hover:scale-100 transition-transform duration-300"
            onClick={handlePlay}
          >
            <svg 
              className="h-5 w-5 text-black fill-current"
              viewBox="0 0 24 24" 
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>
      
      {/* Información de la canción */}
      <div className="p-2.5">
        <h3 className="text-white text-sm font-medium line-clamp-1 mb-0.5">{title}</h3>
        <p className="text-gray-400 text-xs line-clamp-1">{artist}</p>
      </div>
    </div>
  );
};

export default HybridMusicCard; 