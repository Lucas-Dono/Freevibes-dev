'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { getAvailableGenres } from '@/services/spotify';

const genres: Record<string, string> = {
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
};

// Lista de géneros populares para mostrar primero
const POPULAR_GENRES = [
  'pop', 'rock', 'hip-hop', 'r&b', 'latin', 'electronic', 
  'jazz', 'classical', 'indie', 'metal', 'soul', 'blues'
];

export default function GenresPage() {
  const [allGenres, setAllGenres] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGenres = async () => {
      try {
        setLoading(true);
        const genresList = await getAvailableGenres();
        setAllGenres(genresList);
        setError(null);
      } catch (err) {
        console.error('Error al cargar géneros:', err);
        setError('Error al cargar los géneros. Por favor, intenta de nuevo más tarde.');
        // En caso de error, mostramos al menos los géneros populares
        setAllGenres(POPULAR_GENRES);
      } finally {
        setLoading(false);
      }
    };

    fetchGenres();
  }, []);

  // Si aún estamos cargando, mostramos un indicador de carga
  if (loading) {
    return (
      <div className="flex justify-center items-center h-60vh">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Ordenamos los géneros: primero los populares, luego todos los demás
  const sortedGenres = [
    ...POPULAR_GENRES,
    ...allGenres.filter(genre => !POPULAR_GENRES.includes(genre))
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="relative mb-8">
        <h1 className="text-3xl font-bold text-white">Explorar Géneros</h1>
        <p className="text-gray-400 mt-2">
          Descubre nueva música organizada por géneros
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {sortedGenres.map((genre) => {
          // Convertimos los guiones a espacios y capitalizamos la primera letra
          const displayName = genre
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
          
          const backgroundImage = genres[genre] || genres['pop'];
          
          return (
            <motion.div
              key={genre}
              whileHover={{ 
                y: -5,
                scale: 1.05,
                transition: { duration: 0.2 }
              }}
            >
              <Link href={`/explore/genre/${genre}`}>
                <div 
                  className="relative h-40 rounded-lg overflow-hidden shadow-lg cursor-pointer"
                  style={{
                    backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.2) 100%), url(${backgroundImage})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                >
                  <div className="absolute inset-0 flex items-end p-4">
                    <h3 className="text-white font-medium text-lg z-10">
                      {displayName}
                    </h3>
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>

      {allGenres.length === 0 && !loading && (
        <div className="text-center py-10">
          <p className="text-gray-400">No se pudieron cargar los géneros.</p>
        </div>
      )}
    </div>
  );
} 