'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrackList } from '@/components/TrackList';
import { searchTracks } from '@/services/spotify';
import { useSearchParams, useRouter } from 'next/navigation';
import debounce from 'lodash.debounce';

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [tracks, setTracks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Función de búsqueda mejorada
  const performSearch = async (searchQuery: string) => {
    if (!searchQuery || !searchQuery.trim()) {
      setTracks([]);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      console.log('Buscando:', searchQuery);
      
      // searchTracks ahora maneja sus propios errores y proporciona datos simulados en caso de fallo
      const results = await searchTracks(searchQuery);
      
      // Verificar si los resultados son los de fallback
      const hasFallbackData = results.length > 0 && results[0].id?.startsWith('fallback_') || results[0].id?.startsWith('error_');
      
      if (hasFallbackData) {
        setError('Servicio de búsqueda no disponible. Mostrando datos simulados.');
      }
      
      setTracks(results || []);
    } catch (err) {
      console.error('Error en búsqueda:', err);
      setError('Error al buscar canciones. Por favor, intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  // Actualizar la URL con el parámetro de búsqueda
  const updateSearchParam = useCallback((value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set('q', value);
    } else {
      params.delete('q');
    }
    router.replace(`/search?${params.toString()}`);
  }, [router, searchParams]);

  // Crear función debounce para la búsqueda
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSearch = useCallback(
    debounce((value: string) => {
      performSearch(value);
      updateSearchParam(value);
    }, 500),
    [updateSearchParam]
  );

  // Manejar cambios en el input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    debouncedSearch(value);
  };

  // Manejar envío del formulario
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    debouncedSearch.cancel();
    performSearch(query);
    updateSearchParam(query);
  };

  // Realizar búsqueda inicial si hay un query en la URL
  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery);
    }
  }, [initialQuery]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6 text-gradient bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
        Buscar Música
      </h1>
      
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <svg className="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            placeholder="Buscar canciones, artistas, álbumes..."
            className="w-full bg-gray-800/50 border border-gray-700 rounded-full py-3 px-4 pl-12 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setTracks([]);
                updateSearchParam('');
              }}
              className="absolute right-14 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <button
            type="submit"
            disabled={isLoading}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
          >
            {isLoading ? (
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-500/20 rounded-lg text-yellow-400">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center my-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      )}

      {!isLoading && tracks.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold text-white mb-4">Resultados de búsqueda</h2>
          <TrackList tracks={tracks} />
        </div>
      )}

      {!isLoading && !error && query && tracks.length === 0 && (
        <div className="text-center py-12">
          <div className="text-5xl mb-4">🔍</div>
          <h3 className="text-xl font-medium text-gray-300 mb-2">No se encontraron resultados</h3>
          <p className="text-gray-400">
            No encontramos resultados para "{query}". Intenta con otros términos.
          </p>
        </div>
      )}
    </div>
  );
} 