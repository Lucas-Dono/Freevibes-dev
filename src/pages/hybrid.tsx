import React, { useState, useEffect, useCallback } from 'react';
import { NextPage, GetServerSideProps } from 'next';
import Head from 'next/head';
import { Track } from '@/types/types';
import { Navbar } from '@/components/Navbar';
import HybridMusicCard from '@/components/HybridMusicCard';
import { getHybridRecommendations, VALID_GENRES } from '@/services/recommendations';
import { usePlayer } from '@/contexts/PlayerContext';
import { SessionProvider } from 'next-auth/react';
import { PlayerProvider } from '@/contexts/PlayerContext';

// Este archivo será renderizado en el lado del cliente
// Esto evita problemas de pre-renderizado estático
const ClientHybrid = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return <HybridPageWithProviders />;
};

// Componente de la página Hybrid que muestra recomendaciones híbridas
const HybridPage: NextPage = () => {
  const [recommendations, setRecommendations] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string>('pop');

  const player = usePlayer();

  // Cargar recomendaciones al montar el componente o cuando cambia el género
  useEffect(() => {
    const fetchRecommendations = async () => {
      setLoading(true);
      try {
        console.log(`Cargando recomendaciones para género: ${selectedGenre}`);
        const data = await getHybridRecommendations(selectedGenre);
        console.log(`Recomendaciones cargadas: ${data.length} tracks`);
        setRecommendations(data);
        setError(null);
      } catch (err) {
        console.error("Error al cargar recomendaciones híbridas:", err);
        setError("No se pudieron cargar las recomendaciones. Inténtalo más tarde.");
        setRecommendations([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [selectedGenre]);

  // Manejador para reproducir una pista
  const handlePlayTrack = useCallback((track: Track) => {
    console.log('Reproduciendo track en HybridPage:', track);

    if (player && player.playTrack) {
      // Verificar si la pista tiene la información mínima necesaria
      if (!track.id && track.youtubeId) {
        track.id = track.youtubeId;
      }

      // Reproducir la canción
      player.playTrack(track);

      // También crear una lista de reproducción basada en las recomendaciones
      // para que se pueda navegar entre canciones
      if (recommendations.length > 0) {
        player.playPlaylist(recommendations, recommendations.findIndex(t =>
          t.id === track.id || t.youtubeId === track.id || t.youtubeId === track.youtubeId)
        );
      }
    } else {
      console.error('El contexto del reproductor no está disponible');
    }
  }, [player, recommendations]);

  // Manejador para cambiar el género seleccionado
  const handleGenreChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedGenre(event.target.value);
  };

  return (
    <>
      <Head>
        <title>FreeVibes Music - Recomendaciones Híbridas</title>
        <meta name="description" content="Descubre música nueva con nuestro sistema de recomendaciones híbrido que combina múltiples fuentes" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="min-h-screen bg-gradient-to-b from-black to-gray-900 text-white">
        <Navbar />

        <div className="container mx-auto px-4 py-8">
          <h1 className="text-4xl font-bold mb-6 text-center">Descubrimiento Híbrido</h1>

          <div className="mb-8 flex justify-center">
            <div className="w-full max-w-md">
              <label htmlFor="genre-select" className="block mb-2 text-sm font-medium">
                Selecciona un género:
              </label>
              <select
                id="genre-select"
                value={selectedGenre}
                onChange={handleGenreChange}
                className="bg-gray-800 border border-gray-700 text-white rounded-lg p-2.5 w-full"
              >
                {VALID_GENRES.map((genre) => (
                  <option key={genre} value={genre}>
                    {genre.charAt(0).toUpperCase() + genre.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center my-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
            </div>
          ) : error ? (
            <div className="bg-red-900 text-white p-4 rounded-md my-6">
              {error}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {recommendations.map((track) => (
                <HybridMusicCard
                  key={`${track.id || track.youtubeId || Math.random().toString(36)}-${track.source || 'default'}`}
                  track={track}
                  onPlay={handlePlayTrack}
                />
              ))}
            </div>
          )}

          {!loading && !error && recommendations.length === 0 && (
            <div className="text-center my-12">
              <p className="text-gray-400">No se encontraron recomendaciones para este género.</p>
            </div>
          )}
        </div>
      </main>
    </>
  );
};

// Envolver la página con los proveedores necesarios
const HybridPageWithProviders = () => (
  <SessionProvider>
    <PlayerProvider>
      <HybridPage />
    </PlayerProvider>
  </SessionProvider>
);

// Add empty getServerSideProps to force dynamic rendering
export const getServerSideProps: GetServerSideProps = async (context) => {
  // No data fetching needed here, just forcing SSR
  return {
    props: {},
  };
};

export default ClientHybrid;
