import React from 'react';
import Link from 'next/link';

interface FeaturedPlaylistsProps {
  playlists: any[];
  title?: string;
}

const FeaturedPlaylists: React.FC<FeaturedPlaylistsProps> = ({ 
  playlists, 
  title = "Colecciones destacadas" 
}) => {
  return (
    <div className="mb-8">
      <h2 className="text-2xl font-bold mb-4 text-white">{title}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
        {playlists.map((item) => {
          // Determinar si es un álbum o una playlist
          const isAlbum = item.album === true || item.type === 'album';
          const linkHref = isAlbum ? `/album/${item.id}` : `/playlist/${item.id}`;
          
          return (
            <Link 
              href={linkHref} 
              key={item.id} 
              className="bg-gray-800/70 rounded-lg overflow-hidden hover:bg-gray-700/80 transition cursor-pointer shadow-md hover:shadow-lg"
            >
              <div>
                <div className="aspect-square relative">
                  <img 
                    src={item.images?.[0]?.url || "https://placehold.co/300x300/333/white?text=Música"} 
                    alt={item.name} 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-20 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
                    <div className="bg-white/90 rounded-full p-2 transform hover:scale-110 transition-transform duration-300">
                      <svg className="h-5 w-5 text-black fill-current" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                </div>
                <div className="p-2.5">
                  <h3 className="text-white text-sm font-medium line-clamp-1 mb-0.5">{item.name}</h3>
                  <p className="text-gray-400 text-xs line-clamp-2 h-8">
                    {isAlbum ? `Álbum de ${item.owner?.display_name || 'artista'}` : item.description}
                  </p>
                  {isAlbum && (
                    <div className="inline-flex items-center mt-1 px-1.5 py-0.5 bg-purple-900/60 rounded text-purple-100 text-xs">
                      Álbum
                    </div>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default FeaturedPlaylists; 