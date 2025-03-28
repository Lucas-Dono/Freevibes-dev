import React, { useState, useEffect } from 'react';
import { NextPage } from 'next';
import Head from 'next/head';
import { Track } from '@/types/types';
import { Navbar } from '@/components/Navbar';
import HybridMusicCard from '@/components/HybridMusicCard';
import { getHybridRecommendations, VALID_GENRES } from '@/services/recommendations';
import { usePlayer } from '@/contexts/PlayerContext';
import { AuthProvider } from '@/app/context/AuthContext';
import { PlayerProvider } from '@/contexts/PlayerContext';

// Envoltura de página con los proveedores de contexto
const HybridMusicPageWithProviders: NextPage = () => {
  return (
    <AuthProvider>
      <PlayerProvider>
        <HybridMusicContent />
      </PlayerProvider>
    </AuthProvider>
  );
};

// Componente de contenido interno que usa los hooks de contexto
const HybridMusicContent = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [genre, setGenre] = useState<string>('pop');
  const { playTrack } = usePlayer();

  // Cargar recomendaciones cuando cambia el género
  useEffect(() => {
    const fetchRecommendations = async () => {
      setLoading(true);
      setError(null);
      try {
        const recommendations = await getHybridRecommendations(genre, 24);
        setTracks(recommendations);
      } catch (err) {
        console.error('Error al obtener recomendaciones:', err);
        setError('No se pudieron cargar las recomendaciones. Inténtelo de nuevo más tarde.');
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [genre]);

  // Manejar la reproducción de una pista
  const handlePlay = (track: Track) => {
    if (playTrack) {
      playTrack(track);
    }
  };

  return (
    <>
      <Head>
        <title>Descubre Música - Sistema Híbrido | MusicPlayer</title>
        <meta name="description" content="Descubre nueva música con nuestro sistema híbrido de recomendaciones" />
      </Head>

      <div className="min-h-screen bg-zinc-900 text-white flex flex-col">
        <Navbar />
        
        <main className="flex-grow container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold mb-2 text-emerald-400">Descubre Nueva Música</h1>
          <p className="text-gray-300 mb-6">Recomendaciones híbridas de Spotify y YouTube Music</p>
          
          <div className="mb-8">
            <label htmlFor="genre-select" className="block text-sm font-medium mb-2">
              Selecciona un género:
            </label>
            <div className="flex flex-wrap gap-2">
              {VALID_GENRES.map((genreName) => (
                <button
                  key={genreName}
                  onClick={() => setGenre(genreName)}
                  className={`px-4 py-2 rounded-full text-sm ${
                    genre === genreName
                      ? 'bg-emerald-500 text-white'
                      : 'bg-zinc-700 text-gray-200 hover:bg-zinc-600'
                  } transition-colors`}
                >
                  {genreName.charAt(0).toUpperCase() + genreName.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {loading && (
            <div className="flex justify-center items-center min-h-[300px]">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
            </div>
          )}

          {error && (
            <div className="bg-red-800/30 border border-red-700 p-4 rounded-md text-white">
              {error}
            </div>
          )}

          {!loading && !error && tracks.length === 0 && (
            <div className="bg-zinc-800 border border-zinc-700 p-4 rounded-md">
              No se encontraron canciones para este género. Intenta con otro género.
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {!loading &&
              tracks.map((track) => (
                <HybridMusicCard 
                  key={`${track.source}-${track.id}`} 
                  track={track} 
                  onPlay={handlePlay} 
                />
              ))}
          </div>
        </main>
        
        <footer className="bg-zinc-950 py-6 mt-8">
          <div className="container mx-auto px-4">
            <p className="text-center text-gray-400 text-sm">
              &copy; {new Date().getFullYear()} MusicVerse - Sistema Híbrido de Recomendaciones Musicales
            </p>
          </div>
        </footer>
      </div>
    </>
  );
};

export default HybridMusicPageWithProviders; 