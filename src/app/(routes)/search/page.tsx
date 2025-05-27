'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { TrackList } from '@/components/TrackList';
// Eliminamos la importación de searchTracks de Spotify
// import { searchTracks } from '@/services/spotify';
import { useSearchParams, useRouter } from 'next/navigation';
import debounce from 'lodash.debounce';
import UnifiedMusicCard from '@/components/UnifiedMusicCard';
import { usePlayer, Track } from '@/contexts/PlayerContext';
// Ya no necesitamos importar la API de YouTube Music
// import { YouTubeMusicAPI } from '@/services/youtube/youtube-music-api';
import { useTranslation } from '@/hooks/useTranslation';
import { playTrack as universalPlayTrack } from '@/services/player/playService';
import { motion } from 'framer-motion';

// Esta configuración asegura que la página se renderice dinámicamente
// evitando problemas de "Unexpected end of JSON" en build time
export const dynamic = 'force-dynamic';

// Eliminamos la creación de la instancia que no usamos
// const youtubeMusic = new YouTubeMusicAPI();

// Interfaz para las sugerencias
interface Suggestion {
  id: string;
  text: string;
  isHistory?: boolean;
  source?: 'local' | 'lastfm' | 'spotify';
  type?: 'artist' | 'track' | 'album' | 'genre' | 'search';
  artist?: string;
  trackName?: string;
  albumName?: string;
  imageUrl?: string;
}

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams?.get('q') || '';
  const { playTrack } = usePlayer();
  const { t, language } = useTranslation();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState(initialQuery);
  const [tracks, setTracks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(!!initialQuery);

  // Estado para las sugerencias de autocompletado
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const suggestionContainerRef = useRef<HTMLDivElement>(null);

  // Para evitar peticiones repetidas
  const lastQueryRef = useRef<string>('');
  const suggestionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Estado para controlar cuando se está realizando una búsqueda desde una sugerencia
  const [isSearchingFromSuggestion, setIsSearchingFromSuggestion] = useState(false);

  // Función de búsqueda mejorada usando YouTube Music - ahora solo se ejecuta manualmente
  const performSearch = async (searchQuery: string) => {
    if (!searchQuery || !searchQuery.trim()) {
      setTracks([]);
      return;
    }

    // Asegurar que las sugerencias estén cerradas durante la búsqueda
    setShowSuggestions(false);
    setIsLoading(true);
    setError('');
    setHasSearched(true);

    try {
      console.log('Buscando en YouTube:', searchQuery);

      // Acceder directamente al endpoint de búsqueda del servidor Node
      const apiUrl = `/api/youtube/search?query=${encodeURIComponent(searchQuery)}&filter=songs&limit=6`;
      console.log('Llamando a API:', apiUrl);

      const response = await fetch(apiUrl);

      console.log('Respuesta recibida. Status:', response.status);

      if (!response.ok) {
        throw new Error(`Error en la API: ${response.status}`);
      }

      const responseText = await response.text();
      console.log('Respuesta como texto:', responseText.substring(0, 100) + '...');

      // Intentar parsear la respuesta como JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Error al parsear JSON:', parseError);
        throw new Error('La respuesta de la API no es un JSON válido');
      }

      console.log('Datos parseados:', data);

      // Verificar si hay resultados
      if (data && Array.isArray(data) && data.length > 0) {
        console.log(`Encontrados ${data.length} resultados de YouTube`);

        // Transformar los resultados al formato esperado por el componente
        const formattedTracks = data.map((track: any) => {
          console.log('Procesando track:', track);
          return {
            id: track.videoId || track.id || 'unknown',
            title: track.title || 'Sin título',
            artist: track.artist || 'Artista desconocido',
            album: track.album || 'YouTube Music',
            cover: track.thumbnail || track.thumbnailUrl || '/placeholder-album.jpg',
            duration: track.duration || 0,
            youtubeId: track.videoId || track.id || 'unknown',
            source: 'youtube'
          };
        });

        console.log('Tracks formateados:', formattedTracks);
        setTracks(formattedTracks);
      } else {
        // Si no hay resultados, mostrar mensaje
        console.log('No se encontraron resultados en YouTube');
        setTracks([]);
        setError('No se encontraron resultados para tu búsqueda. Intenta con otros términos.');
      }
    } catch (err) {
      console.error('Error en búsqueda de YouTube:', err);
      setError('Error al buscar canciones. Por favor, intenta de nuevo.');
      setTracks([]);
    } finally {
      setIsLoading(false);
      // Mantener el estado de búsqueda pero forzar que se cierren las sugerencias
      setShowSuggestions(false);

      // Programar el restablecimiento del estado de búsqueda después de un tiempo
      // para permitir interacciones futuras
      setTimeout(() => {
        if (!isLoading && hasSearched) {
          // Solo permitir nuevas sugerencias si el usuario interactúa nuevamente
          // con el campo de búsqueda
          setIsSearchingFromSuggestion(false);
        }
      }, 1000);
    }
  };

  // Actualizar la URL con el parámetro de búsqueda
  const updateSearchParam = useCallback((value: string) => {
    if (!searchParams) return;

    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set('q', value);
    } else {
      params.delete('q');
    }
    router.replace(`/search?${params.toString()}`);
  }, [router, searchParams]);

  // MODIFICACIÓN: Ya no creamos un debounce para búsqueda automática
  // La búsqueda ahora solo se ejecuta cuando el usuario hace clic o presiona Enter

  // Función para buscar sugerencias con optimizaciones y fallback local
  const fetchSuggestions = async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Evitar búsquedas repetidas de la misma consulta
    if (searchQuery.toLowerCase() === lastQueryRef.current.toLowerCase()) {
      setShowSuggestions(suggestions.length > 0);
      return;
    }

    // Actualizar la referencia de la última consulta
    lastQueryRef.current = searchQuery;

    // Cancelar cualquier timeout anterior
    if (suggestionTimeoutRef.current) {
      clearTimeout(suggestionTimeoutRef.current);
    }

    setIsLoadingSuggestions(true);

    try {
      // Usar el endpoint combinado
      const response = await fetch(`/api/combined/suggest?query=${encodeURIComponent(searchQuery)}&limit=6`);

      if (!response.ok) {
        throw new Error(`Error en la API de sugerencias: ${response.status}`);
      }

      const data = await response.json();

      // Solo actualizar si esta sigue siendo la última consulta
      // (para evitar resultados fuera de orden)
      if (searchQuery.toLowerCase() === lastQueryRef.current.toLowerCase()) {
        setSuggestions(data);
        setShowSuggestions(data.length > 0);
      }
    } catch (err) {
      console.error('Error al obtener sugerencias:', err);

      // FALLBACK: Generar sugerencias locales si el servidor no responde
      const queryLower = searchQuery.toLowerCase();

      // Lista de artistas y canciones populares para el fallback
      const fallbackItems: Suggestion[] = [
        { id: 'local-artist-bad-bunny', text: 'Bad Bunny', type: 'artist', source: 'local' },
        { id: 'local-artist-taylor-swift', text: 'Taylor Swift', type: 'artist', source: 'local' },
        { id: 'local-artist-the-weeknd', text: 'The Weeknd', type: 'artist', source: 'local' },
        { id: 'local-track-blinding-lights', text: 'Blinding Lights - The Weeknd', type: 'track', artist: 'The Weeknd', trackName: 'Blinding Lights', source: 'local' },
        { id: 'local-track-as-it-was', text: 'As It Was - Harry Styles', type: 'track', artist: 'Harry Styles', trackName: 'As It Was', source: 'local' },
        { id: 'local-track-flowers', text: 'Flowers - Miley Cyrus', type: 'track', artist: 'Miley Cyrus', trackName: 'Flowers', source: 'local' },
        { id: 'local-album-un-verano-sin-ti', text: 'Un Verano Sin Ti - Bad Bunny', type: 'album', artist: 'Bad Bunny', albumName: 'Un Verano Sin Ti', source: 'local' },
        { id: 'local-album-midnights', text: 'Midnights - Taylor Swift', type: 'album', artist: 'Taylor Swift', albumName: 'Midnights', source: 'local' }
      ];

      // Filtrar por la consulta
      const matchedItems = fallbackItems.filter(item =>
        item.text.toLowerCase().includes(queryLower)
      );

      // Usar sugerencias locales como fallback
      if (matchedItems.length > 0) {
        setSuggestions(matchedItems);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  // Función debounce para las sugerencias - tiempo aumentado para reducir carga del servidor
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSuggestions = useCallback(
    debounce((value: string) => {
      fetchSuggestions(value);
    }, 350), // Aumentado a 350ms para reducir llamadas en servidores gratuitos
    []
  );

  // MODIFICACIÓN: Controlador de cambios en el input ahora solo actualiza sugerencias, no ejecuta búsqueda
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    // Si estamos buscando desde una sugerencia recién seleccionada o ya hemos buscado,
    // no mostrar el panel a menos que el texto cambie
    if (isSearchingFromSuggestion || hasSearched) {
      // Solo permitir nuevas sugerencias si el usuario edita el texto
      if (value !== lastQueryRef.current) {
        // El usuario está cambiando el texto, así que podemos mostrar sugerencias
        // para la nueva consulta
        setIsSearchingFromSuggestion(false);

        // Si estamos modificando una búsqueda previa, mantener el estado
        // de búsqueda pero permitir nuevas sugerencias
        if (hasSearched && value.trim()) {
          // Solo reiniciar hasSearched si borramos completamente el texto
          if (!value.trim()) {
            setHasSearched(false);
          }
        }
      } else {
        return; // No mostrar sugerencias si el texto no ha cambiado
      }
    }

    // Si no hay texto, ocultar sugerencias inmediatamente
    if (!value.trim()) {
      setShowSuggestions(false);
      setSuggestions([]);
      setHasSearched(false);
      return;
    }

    // Si el texto es muy corto, no mostrar sugerencias
    if (value.length < 2) {
      setShowSuggestions(false);
      return;
    }

    // Usar debounce para las sugerencias para reducir llamadas al servidor
    debouncedSuggestions(value);
  };

  // Manejar clic en una sugerencia con optimizaciones
  const handleSuggestionClick = (suggestion: Suggestion) => {
    // Cerrar el panel de sugerencias inmediatamente
    setShowSuggestions(false);

    // Indicar que estamos realizando una búsqueda desde sugerencia
    setIsSearchingFromSuggestion(true);

    // Construir el texto de búsqueda según el tipo de sugerencia
    let searchText = suggestion.text;

    // Para búsquedas más precisas según el tipo
    if (suggestion.type === 'artist' && suggestion.text) {
      searchText = suggestion.text; // Buscar solo por nombre de artista
    } else if (suggestion.type === 'track' && suggestion.artist && suggestion.trackName) {
      searchText = `${suggestion.trackName} ${suggestion.artist}`; // Buscar canción + artista
    } else if (suggestion.type === 'album' && suggestion.artist && suggestion.albumName) {
      searchText = `${suggestion.albumName} ${suggestion.artist}`; // Buscar álbum + artista
    }

    // Evitar búsquedas repetidas
    if (searchText === query) {
      return;
    }

    setQuery(searchText);

    // Actualizar la referencia de la última consulta para evitar peticiones adicionales
    lastQueryRef.current = searchText;

    // Bloquear la reapertura del panel de sugerencias durante la búsqueda
    const blockSuggestions = () => {
      // Cancelar cualquier debounce pendiente para evitar que se muestren sugerencias
      debouncedSuggestions.cancel();
    };

    blockSuggestions();

    // MODIFICACIÓN: Al hacer clic en una sugerencia, ahora ejecutamos la búsqueda inmediatamente
    // ya que es una acción explícita del usuario
    performSearch(searchText);
    updateSearchParam(searchText);

    // Añadir la búsqueda al historial (enviando al backend)
    try {
      fetch('/api/search/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchText })
      }).catch(err => console.error('Error al guardar en historial:', err));
    } catch (err) {
      // Silenciar errores del historial para no interrumpir el flujo
    }

    // Enfocar el campo de búsqueda
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  // MODIFICACIÓN: Manejar envío del formulario para ejecutar la búsqueda
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Cerrar panel de sugerencias inmediatamente
    setShowSuggestions(false);

    // Cancelar cualquier debounce pendiente
    debouncedSuggestions.cancel();

    // Solo ejecutar búsqueda si hay texto
    if (query.trim()) {
      // Establecer modo de búsqueda para evitar que se muestren sugerencias
      setIsSearchingFromSuggestion(true);

      performSearch(query);
      updateSearchParam(query);
    }
  };

  // Cerrar las sugerencias cuando se hace clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionContainerRef.current &&
        !suggestionContainerRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Evitar que se muestren sugerencias después de realizar una búsqueda
  useEffect(() => {
    if (hasSearched) {
      setShowSuggestions(false);
    }
  }, [hasSearched, tracks]);

  // Realizar búsqueda inicial si hay un query en la URL
  useEffect(() => {
    if (initialQuery) {
      // Asegurarse de que también se actualizan las sugerencias
      lastQueryRef.current = initialQuery;

      // Realizar búsqueda inicial con el query de la URL
      performSearch(initialQuery);

      // También buscar sugerencias si corresponde
      if (initialQuery.length >= 2) {
        fetchSuggestions(initialQuery);
      }
    }
  }, [initialQuery]);

  // Modificar la forma en que se muestran las sugerencias cuando el input recibe foco
  const handleInputFocus = () => {
    // Solo mostrar sugerencias si no estamos en modo de búsqueda desde sugerencia
    // y si hay texto en el campo y sugerencias disponibles
    if (!isSearchingFromSuggestion && query.trim() && suggestions.length > 0 && !hasSearched) {
      setShowSuggestions(true);
    }
  };

  // Función para reproducir una canción desde los resultados de búsqueda
  const handlePlayTrack = async (track: any) => {
    try {
      console.log('Reproduciendo track de YouTube:', track);
      await universalPlayTrack(track);
    } catch (error) {
      console.error('Error al reproducir track de YouTube:', error);
    }
  };

  return (
    <div className="bg-gradient-to-b from-zinc-900 to-black min-h-screen">
      {/* Container responsive: padding reducido en móvil */}
      <div className="container mx-auto px-4 md:px-6 py-4 md:py-8 max-w-4xl">
        <motion.h1 
          className="text-2xl md:text-3xl font-bold mb-4 md:mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {t('search.searchMusic')}
        </motion.h1>

        <motion.form 
          onSubmit={handleSubmit} 
          className="mb-6 md:mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <svg className="w-4 h-4 md:w-5 md:h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={query}
              onChange={handleInputChange}
              placeholder={t('search.searchPlaceholder')}
              className="w-full bg-zinc-800/50 border border-zinc-700 rounded-full py-2.5 md:py-3 px-3 md:px-4 pl-10 md:pl-12 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-sm md:text-base"
              autoFocus
              ref={searchInputRef}
              onFocus={handleInputFocus}
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setTracks([]);
                  setSuggestions([]);
                  setShowSuggestions(false);
                  setHasSearched(false);
                  updateSearchParam('');
                }}
                className="absolute right-12 md:right-14 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4 md:w-5 md:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            <button
              type="submit"
              disabled={isLoading}
              className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
            >
              {isLoading ? (
                <svg className="w-4 h-4 md:w-5 md:h-5 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 md:w-5 md:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
            </button>

            {/* Lista de sugerencias */}
            {showSuggestions && suggestions.length > 0 && (
              <div
                ref={suggestionContainerRef}
                className="absolute z-10 left-0 right-0 mt-2 py-2 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg backdrop-blur-sm"
              >
                {isLoadingSuggestions ? (
                  <div className="flex justify-center py-3">
                    <div className="animate-spin rounded-full h-4 w-4 md:h-5 md:w-5 border-t-2 border-b-2 border-purple-500"></div>
                  </div>
                ) : (
                  <ul>
                    {suggestions.map((suggestion) => (
                      <li
                        key={suggestion.id}
                        className="px-3 md:px-4 py-2 md:py-2.5 hover:bg-zinc-700 cursor-pointer transition-colors text-white flex items-center text-sm md:text-base"
                        onClick={() => handleSuggestionClick(suggestion)}
                      >
                        {/* Icono según el tipo de sugerencia */}
                        {suggestion.type === 'track' ? (
                          <svg className="w-3 h-3 md:w-4 md:h-4 mr-2 text-purple-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 17H5a2 2 0 0 0-2 2 2 2 0 0 0 2 2h2a2 2 0 0 0 2-2zm12-2h-4a2 2 0 0 0-2 2 2 2 0 0 0 2 2h2a2 2 0 0 0 2-2z" />
                            <path d="M9 17V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v8" />
                          </svg>
                        ) : suggestion.type === 'artist' ? (
                          <svg className="w-3 h-3 md:w-4 md:h-4 mr-2 text-green-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="8" r="5" />
                            <path d="M20 21v-2a7 7 0 0 0-14 0v2" />
                          </svg>
                        ) : suggestion.type === 'album' ? (
                          <svg className="w-3 h-3 md:w-4 md:h-4 mr-2 text-pink-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        ) : suggestion.source === 'lastfm' ? (
                          <svg className="w-3 h-3 md:w-4 md:h-4 mr-2 text-red-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                          </svg>
                        ) : suggestion.isHistory ? (
                          <svg className="w-3 h-3 md:w-4 md:h-4 mr-2 text-blue-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        ) : (
                          <svg className="w-3 h-3 md:w-4 md:h-4 mr-2 text-gray-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        )}
                        <span className="flex-grow truncate">{suggestion.text}</span>

                        {/* Etiquetas según la fuente y tipo */}
                        <div className="flex flex-shrink-0 ml-2 space-x-1">
                          {suggestion.source === 'lastfm' && (
                            <span className="text-xs px-1.5 md:px-2 py-0.5 bg-red-900/30 text-red-400 rounded hidden md:inline">Last.fm</span>
                          )}
                          {suggestion.isHistory && (
                            <span className="text-xs px-1.5 md:px-2 py-0.5 bg-blue-900/30 text-blue-400 rounded hidden md:inline">{t('search.history')}</span>
                          )}
                          {suggestion.type && !suggestion.isHistory && (
                            <span className={`text-xs px-1.5 md:px-2 py-0.5 rounded hidden md:inline ${
                              suggestion.type === 'track' ? 'bg-purple-900/30 text-purple-400' :
                              suggestion.type === 'artist' ? 'bg-green-900/30 text-green-400' :
                              suggestion.type === 'album' ? 'bg-pink-900/30 text-pink-400' :
                              suggestion.type === 'genre' ? 'bg-yellow-900/30 text-yellow-400' :
                              'bg-gray-900/30 text-gray-400'
                            }`}>
                              {suggestion.type === 'track' ? t('search.types.track') :
                               suggestion.type === 'artist' ? t('search.types.artist') :
                               suggestion.type === 'album' ? t('search.types.album') :
                               suggestion.type === 'genre' ? t('search.types.genre') :
                               t('search.types.search')}
                            </span>
                          )}
                        </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
                      )}
          </div>
        </motion.form>

                {/* Mensaje de búsqueda vacía */}
          {query.length === 0 && !isLoading && (
            <motion.div 
              className="text-center py-8 md:py-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="inline-block p-3 md:p-4 rounded-full bg-zinc-800/50 mb-3 md:mb-4">
                <svg className="w-8 h-8 md:w-10 md:h-10 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h2 className="text-lg md:text-xl font-medium text-gray-300 mb-2">{t('search.startTyping')}</h2>
              <p className="text-gray-400 max-w-md mx-auto text-sm md:text-base px-4">{t('search.searchDescription')}</p>
            </motion.div>
          )}

                {/* Loader durante la búsqueda */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-8 md:py-10">
              <div className="w-12 h-12 md:w-16 md:h-16 border-t-2 border-b-2 border-purple-500 rounded-full animate-spin mb-3 md:mb-4"></div>
              <h2 className="text-lg md:text-xl font-medium text-gray-300">{t('search.searching')}</h2>
            </div>
          )}

                {/* Mensaje de error */}
          {error && !isLoading && (
            <div className="bg-red-900/20 border border-red-800/30 rounded-lg p-3 md:p-4 text-center my-4 md:my-6 mx-2 md:mx-0">
              <p className="text-red-300 text-sm md:text-base">{error}</p>
            </div>
          )}

                {/* Resultados de búsqueda - Ahora solo se muestra si hasSearched es true */}
          {query.length > 0 && !isLoading && tracks.length === 0 && !error && hasSearched && (
            <motion.div 
              className="text-center py-8 md:py-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-block p-3 md:p-4 rounded-full bg-zinc-800/50 mb-3 md:mb-4">
                <svg className="w-8 h-8 md:w-10 md:h-10 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-lg md:text-xl font-medium text-gray-300 mb-2">{t('search.noResults')}</h2>
              <p className="text-gray-400 max-w-md mx-auto text-sm md:text-base px-4">{t('search.tryAgain')}</p>
            </motion.div>
          )}

                {/* Resultados de búsqueda */}
          {!isLoading && tracks.length > 0 && (
            <div>
              <h2 className="text-lg md:text-xl font-bold mb-4 md:mb-6">{t('search.results')}</h2>
              
              {/* Vista móvil: Lista vertical compacta */}
              <div className="md:hidden space-y-3">
                {tracks.map((track, index) => (
                  <motion.div
                    key={track.id}
                    className="flex items-center gap-3 p-3 bg-zinc-800/30 rounded-lg hover:bg-zinc-700/30 transition-colors duration-200"
                    onClick={() => handlePlayTrack(track)}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                  >
                    <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                      <img
                        src={track.cover || '/placeholder-album.jpg'}
                        alt={track.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-white text-sm truncate">{track.title}</h3>
                      <p className="text-zinc-400 text-xs truncate">{track.artist}</p>
                    </div>
                    <div className="bg-red-600 text-white text-xs px-2 py-1 rounded-full">
                      YT
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Vista desktop: Grid de tarjetas */}
              <div className="hidden md:grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                {tracks.map((track, index) => (
                  <motion.div
                    key={track.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                  >
                    <UnifiedMusicCard
                      id={track.id}
                      title={track.title}
                      subtitle={track.artist}
                      coverUrl={track.cover}
                      duration={track.duration}
                      isPlayable={true}
                      badge={{ text: 'YouTube', color: 'bg-red-600' }}
                      onClick={() => handlePlayTrack(track)}
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          )}
      </div>
    </div>
  );
}
