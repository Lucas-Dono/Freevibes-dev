import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAvailableGenres } from '@/services/recommendations';
import { obtenerGenerosValidados } from '@/lib/validation/genre-validator';
import { getSourceManager, SourceType } from '@/lib/source-manager';
import GenreImage from '@/components/GenreImage';

interface GenreSelectorProps {
  onGenreSelect?: (genre: string, source: SourceType) => void;
}

export default function GenreSelector({ onGenreSelect }: GenreSelectorProps) {
  const [genres, setGenres] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSource, setCurrentSource] = useState<SourceType>('spotify');
  const [sourcesValid, setSourcesValid] = useState<Record<SourceType, boolean>>({
    spotify: true,
    lastfm: true,
    youtube: true,
    deezer: true
  });
  
  const router = useRouter();
  const sourceManager = getSourceManager();
  
  // Cargar géneros de la fuente actual
  useEffect(() => {
    let isMounted = true;
    
    async function loadGenres() {
      if (!isMounted) return;
      
      setIsLoading(true);
      
      try {
        // Intentar cargar géneros de la fuente actual
        let genresData: string[] = [];
        let token = '';
        
        if (currentSource === 'spotify') {
          try {
            // Obtener token para validación
            console.log('[GenreSelector] Obteniendo token de Spotify');
            const tokenResponse = await fetch('/api/auth/spotify/token');
            
            if (!tokenResponse.ok) {
              throw new Error(`Error HTTP: ${tokenResponse.status}`);
            }
            
            // Verificar que la respuesta es JSON válido
            const contentType = tokenResponse.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
              console.error('[GenreSelector] Respuesta no es JSON válido');
              throw new Error('Respuesta de API no válida');
            }
            
            const tokenData = await tokenResponse.json();
            token = tokenData.access_token;
            
            if (!token) {
              throw new Error('Token de acceso no proporcionado');
            }
            
            // Obtener géneros de Spotify
            genresData = await getAvailableGenres();
          } catch (spotifyError) {
            console.error('[GenreSelector] Error con Spotify:', spotifyError);
            // Cambiar a una fuente alternativa
            await sourceManager.registerSourceError('spotify');
            
            if (isMounted) {
              setSourcesValid(prev => ({ ...prev, spotify: false }));
              // Intentar con Last.fm en su lugar
              const nextSource = await sourceManager.getBestSource();
              setCurrentSource(nextSource);
              return; // Salir y dejar que el efecto se ejecute de nuevo con la nueva fuente
            }
          }
        } 
        else if (currentSource === 'lastfm') {
          console.log('[GenreSelector] Usando géneros de Last.fm');
          // Implementar lógica para Last.fm (fallback)
          genresData = [
            'rock', 'electronic', 'indie', 'pop', 'hip-hop', 
            'folk', 'metal', 'punk', 'soul', 'ambient'
          ];
        }
        else if (currentSource === 'youtube') {
          console.log('[GenreSelector] Usando géneros de YouTube');
          // Implementar lógica para YouTube Music (fallback)
          genresData = [
            'pop', 'rap', 'rock', 'latin', 'r&b', 'jazz',
            'electronic', 'country', 'k-pop', 'metal'
          ];
        }
        
        if (genresData.length > 0) {
          // Validar géneros para asegurarnos que funcionan
          const validatedGenres = await obtenerGenerosValidados(
            genresData,
            token,
            currentSource
          );
          
          if (validatedGenres.length > 0) {
            // Registrar éxito para esta fuente
            await sourceManager.registerSourceSuccess(currentSource);
            
            if (isMounted) {
              setGenres(validatedGenres);
              setSourcesValid(prev => ({ ...prev, [currentSource]: true }));
            }
          } else {
            // Si no hay géneros válidos, registrar error
            console.warn(`No se encontraron géneros válidos para ${currentSource}`);
            await sourceManager.registerSourceError(currentSource);
            
            if (isMounted) {
              setSourcesValid(prev => ({ ...prev, [currentSource]: false }));
            
              // Buscar siguiente fuente válida
              const nextSource = await sourceManager.getBestSource();
              if (nextSource !== currentSource) {
                setCurrentSource(nextSource);
                return; // El efecto se ejecutará de nuevo con la nueva fuente
              }
            }
          }
        } else {
          // Si no hay datos, registrar error
          await sourceManager.registerSourceError(currentSource);
          
          if (isMounted) {
            setSourcesValid(prev => ({ ...prev, [currentSource]: false }));
          
            // Buscar siguiente fuente válida
            const nextSource = await sourceManager.getBestSource();
            if (nextSource !== currentSource) {
              setCurrentSource(nextSource);
              return; // El efecto se ejecutará de nuevo con la nueva fuente
            }
          }
        }
      } catch (error) {
        console.error(`Error cargando géneros de ${currentSource}:`, error);
        
        // Marcar la fuente actual como inválida
        await sourceManager.registerSourceError(currentSource);
        
        if (isMounted) {
          setSourcesValid(prev => ({ ...prev, [currentSource]: false }));
        
          // Buscar siguiente fuente válida
          const nextSource = await sourceManager.getBestSource();
          if (nextSource !== currentSource) {
            setCurrentSource(nextSource);
            return; // El efecto se ejecutará de nuevo con la nueva fuente
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
      
      // Si llegamos aquí y no hay géneros después de intentar todas las fuentes,
      // usar géneros fallback
      if (isMounted && genres.length === 0) {
        console.log('[GenreSelector] Usando géneros fallback');
        setGenres([
          'pop', 'rock', 'hip-hop', 'electronic', 'jazz', 'r&b',
          'latin', 'classical', 'indie', 'metal'
        ]);
      }
    }
    
    loadGenres();
    
    return () => {
      isMounted = false;
    };
  }, [currentSource]);
  
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
  
  if (genres.length === 0) {
    return (
      <div className="text-center p-6">
        <p className="mb-4">No se pudieron cargar géneros de ninguna fuente</p>
        <button 
          onClick={() => setCurrentSource('lastfm')}
          className="px-4 py-2 bg-green-500 text-white rounded-md"
        >
          Reintentar
        </button>
      </div>
    );
  }
  
  return (
    <div>
      {/* Indicador de fuente (opcional, se puede ocultar) */}
      {false && (
        <div className="flex justify-end mb-2 gap-2">
          {Object.entries(sourcesValid)
            .filter(([_, isValid]) => isValid)
            .map(([source]) => (
              <button 
                key={source}
                className={`px-3 py-1 text-sm rounded-full ${
                  currentSource === source 
                    ? 'bg-green-500 text-white' 
                    : 'bg-gray-200 text-gray-700'
                }`}
                onClick={() => setCurrentSource(source as SourceType)}
              >
                {source.charAt(0).toUpperCase() + source.slice(1)}
              </button>
            ))}
        </div>
      )}
      
      {/* Grid de géneros */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
        {genres.map((genre) => (
          <div 
            key={genre}
            className="bg-card hover:bg-card/80 transition-colors rounded-lg overflow-hidden cursor-pointer shadow-md hover:shadow-lg"
            onClick={() => handleGenreClick(genre)}
          >
            <div className="aspect-square relative overflow-hidden">
              <GenreImage 
                genre={genre}
                artistName={genre.charAt(0).toUpperCase() + genre.slice(1)}
                size="large"
                className="w-full h-full"
              />
              <div className="absolute inset-0 bg-black bg-opacity-10 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
                <div className="bg-white/80 rounded-full p-2 transform hover:scale-110 transition-transform duration-300">
                  <svg className="h-5 w-5 text-black fill-current" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="p-2.5">
              <h3 className="text-white text-sm font-medium line-clamp-1">
                {genre.charAt(0).toUpperCase() + genre.slice(1)}
              </h3>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 