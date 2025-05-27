'use client';

import { useState, useEffect } from 'react';
import { notFound } from 'next/navigation';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { usePlayer } from '@/contexts/PlayerContext';
// Reemplazar las importaciones por nuestro sistema multi-fuente
import { getRecommendationsByGenre } from '@/services/recommendations';
import { Track } from '@/types/types';
// Importar nuestro nuevo componente GenreImage
import GenreImage from '@/components/GenreImage';
// Importamos el servicio universal
import { playTrack as universalPlayTrack } from '@/services/player/playService';

// Imágenes de fondo para géneros
const genreImages: Record<string, string> = {
  'pop': 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819',
  'rock': 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee',
  'hip-hop': 'https://images.unsplash.com/photo-1601643157091-ce5c665179ab',
  'electronic': 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745',
  'jazz': 'https://images.unsplash.com/photo-1511192336575-5a79af67a629',
  'r&b': 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f',
  'latin': 'https://images.unsplash.com/photo-1535324492437-d8dea70a38a7',
  'classical': 'https://images.unsplash.com/photo-1507838153414-b4b713384a76',
  'indie': 'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b',
  'metal': 'https://images.unsplash.com/photo-1629276301820-0f3eedc29fd0',
  'soul': 'https://images.unsplash.com/photo-1605722625766-a4c989c747a4',
  'blues': 'https://images.unsplash.com/photo-1601312378427-822b2b41da35',
  'alternative': 'https://images.unsplash.com/photo-1571330735066-03aaa9429d89',
  'punk': 'https://images.unsplash.com/photo-1598387993281-cecf8b71a8f8',
  'reggae': 'https://images.unsplash.com/photo-1540039628-1432a508c3fd',
  'country': 'https://images.unsplash.com/photo-1581290723777-fd2c6fba9b44',
  'folk': 'https://images.unsplash.com/photo-1499364615650-ec38552f4f34',
  'default': 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4',
};

export default function GenrePage() {
  const { genre } = useParams() as { genre: string };
  const { playTrack } = usePlayer();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const backgroundImage = genreImages[genre] || genreImages['default'];
  const formattedGenre = genre.charAt(0).toUpperCase() + genre.slice(1).replace(/-/g, ' ');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Usar el nuevo sistema multi-fuente para obtener recomendaciones por género
        const tracksData = await getRecommendationsByGenre(genre, 30);

        // Si no hay tracks, mostrar la página 404
        if (!tracksData || tracksData.length === 0) {
          notFound();
          return;
        }

        setTracks(tracksData);
        setError(null);
      } catch (err) {
        console.error(`Error al cargar tracks del género ${genre}:`, err);
        setError('Error al cargar las canciones. Por favor, intenta de nuevo más tarde.');
      } finally {
        setLoading(false);
      }
    };

    if (genre) {
      fetchData();
    }
  }, [genre]);

  // Función para reproducir una pista usando el servicio universal
  const handlePlayTrack = async (track: Track) => {
    try {
      console.log(`[GenrePage] Intentando reproducir track: ${track.title} - ${track.artist}`);
      // Usar el servicio universal para reproducción
      await universalPlayTrack(track);
    } catch (error) {
      console.error(`[GenrePage] Error al reproducir track: ${track.title}`, error);
    }
  };

  // Función para reproducir todas las pistas como una playlist
  const handlePlayAll = async () => {
    if (tracks.length > 0) {
      try {
        console.log(`[GenrePage] Reproduciendo playlist completa de género: ${genre}`);
        // Al reproducir la primera pista con el servicio universal
        await universalPlayTrack(tracks[0]);
        // Nota: La generación de playlist automática se maneja en el servicio
      } catch (error) {
        console.error(`[GenrePage] Error al iniciar playlist de género`, error);
      }
    } else {
      console.warn(`[GenrePage] No hay tracks disponibles para reproducir`);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-60vh">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Encabezado del género con imagen de fondo */}
      <div
        className="relative flex items-end w-full bg-cover bg-center h-64 md:h-80"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.8)), url(${backgroundImage})`
        }}
      >
        <div className="container mx-auto px-4 pb-6">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
            {formattedGenre}
          </h1>
          <p className="text-gray-200">
            Explora las mejores canciones de {formattedGenre}
          </p>
        </div>
      </div>

      {/* Lista de canciones */}
      <div className="container mx-auto px-4 py-8">
        {/* Botón de reproducir todo */}
        <div className="mb-6">
          <button
            onClick={handlePlayAll}
            className="bg-primary hover:bg-primary-dark text-white font-medium py-3 px-6 rounded-full flex items-center space-x-2 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
            <span>Reproducir todas</span>
          </button>
        </div>

        {/* Lista de tracks */}
        <div className="bg-zinc-900/50 rounded-xl overflow-hidden shadow-xl">
          <div className="grid grid-cols-12 p-4 border-b border-gray-800 text-gray-400 font-medium">
            <div className="col-span-1 text-center">#</div>
            <div className="col-span-6 md:col-span-5">Título</div>
            <div className="hidden md:block md:col-span-3">Artista</div>
            <div className="col-span-4 md:col-span-2 text-center">Duración</div>
            <div className="col-span-1 text-center"></div>
          </div>

          {tracks.map((track, index) => (
            <div
              key={track.id || `track-${index}`}
              className="grid grid-cols-12 p-4 border-b border-gray-800 hover:bg-zinc-800/50 transition-colors items-center"
            >
              <div className="col-span-1 text-center text-gray-500">{index + 1}</div>
              <div className="col-span-6 md:col-span-5 flex items-center space-x-3">
                <div className="w-10 h-10 flex-shrink-0">
                  <GenreImage
                    genre={track.album || genre}
                    artistName={track.artist}
                    size="small"
                  />
                </div>
                <div className="truncate">
                  <p className="text-white font-medium truncate">{track.title}</p>
                </div>
              </div>
              <div className="hidden md:block md:col-span-3 text-gray-400 truncate">
                {track.artist}
              </div>
              <div className="col-span-4 md:col-span-2 text-center text-gray-400">
                {formatDuration(track.duration)}
              </div>
              <div className="col-span-1 text-center">
                <button
                  onClick={() => handlePlayTrack(track)}
                  className="text-gray-400 hover:text-primary transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Función para formatear la duración
function formatDuration(durationInMs: number): string {
  const totalSeconds = Math.floor(durationInMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
