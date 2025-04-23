'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { TOP_GENRES, GenreItem } from '@/services/youtube/genres-service';
import GenreImage from '@/components/GenreImage';

export default function GenresPage() {
  const [loading, setLoading] = useState(false);

  // Usar directamente los 10 géneros principales
  const topGenres = TOP_GENRES;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="relative mb-8">
        <h1 className="text-3xl font-bold text-white">Explorar Géneros</h1>
        <p className="text-gray-400 mt-2">
          Descubre música en los 10 géneros más populares
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {topGenres.map((genre: GenreItem) => {
          return (
            <motion.div
              key={genre.id}
              whileHover={{
                y: -5,
                scale: 1.05,
                transition: { duration: 0.2 }
              }}
            >
              <Link href={`/explore/genre/${genre.id}`}>
                <div
                  className="relative h-40 rounded-lg overflow-hidden shadow-lg cursor-pointer"
                >
                  <GenreImage
                    genre={genre.id}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-top from-black/80 via-black/40 to-transparent">
                    <div className="absolute bottom-0 left-0 p-4">
                      <h3 className="text-white font-medium text-lg z-10">
                        {genre.name}
                      </h3>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
