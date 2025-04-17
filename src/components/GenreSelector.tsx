import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SourceType } from '@/lib/source-manager';
import GenreImage from '@/components/GenreImage';
import { TOP_GENRES, GenreItem } from '@/services/youtube/genres-service';

interface GenreSelectorProps {
  onGenreSelect?: (genre: string, source: SourceType) => void;
}

export default function GenreSelector({ onGenreSelect }: GenreSelectorProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [currentSource, setCurrentSource] = useState<SourceType>('youtube');
  const router = useRouter();
  
  // Lista fija de los 10 géneros principales
  const topGenres = TOP_GENRES;
  
  // Manejar selección de género
  const handleGenreClick = (genre: string) => {
    if (onGenreSelect) {
      onGenreSelect(genre, currentSource);
    } else {
      router.push(`/explore/genre/${genre}?source=${currentSource}`);
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className="w-8 h-8 border-4 border-gray-300 border-t-green-500 rounded-full animate-spin"></div>
      </div>
    );
  }
  
  return (
    <div className="overflow-hidden">
      <h2 className="text-xl font-semibold mb-3 text-white">Géneros</h2>
      
      <div className="flex overflow-x-auto pb-4 gap-3 scrollbar-hide">
        {topGenres.map((genre: GenreItem) => (
          <div 
            key={genre.id}
            onClick={() => handleGenreClick(genre.id)}
            className="flex-none cursor-pointer transition-transform hover:scale-105"
          >
            <div className="w-32 h-32 relative rounded-lg overflow-hidden">
              <GenreImage genre={genre.id} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/20 flex items-end p-2">
                <span className="text-white font-medium text-sm">{genre.name}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 