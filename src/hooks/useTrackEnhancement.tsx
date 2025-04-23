import { useState, useEffect, useCallback } from 'react';
import { Track } from '@/types/types';
import { loadOrchestrator } from '@/services/orchestration';
import { usePathname } from 'next/navigation';
import { getPageTypeFromPath, asSectionType } from '@/lib/navigation-map';

interface TrackEnhancementOptions {
  section?: string;
  isVisible?: boolean;
  completeImages?: boolean;
  completeYoutubeIds?: boolean;
  updateCallback?: (tracks: Track[]) => void;
}

/**
 * Hook para mejorar tracks con datos completos utilizando el orquestrador de carga
 *
 * Este hook facilita la integración del orquestrador de carga en componentes
 * que muestran tracks, automatizando la solicitud de datos completos.
 */
export function useTrackEnhancement(
  initialTracks: Track[] = [],
  options: TrackEnhancementOptions = {}
) {
  const [tracks, setTracks] = useState<Track[]>(initialTracks);
  const [isLoading, setIsLoading] = useState(false);
  const [isEnhanced, setIsEnhanced] = useState(false);
  const pathname = usePathname();

  // Obtener información de la página y sección actual
  const pageType = getPageTypeFromPath(pathname || '/');
  const sectionType = asSectionType(options.section || 'otros');

  // Función para solicitar mejora de tracks
  const enhanceTracks = useCallback((tracksToEnhance: Track[] = tracks) => {
    if (!tracksToEnhance.length) return;

    setIsLoading(true);

    loadOrchestrator.enqueueLoad(
      tracksToEnhance,
      {
        page: pageType,
        section: sectionType,
        isVisible: options.isVisible ?? true,
        completeImages: options.completeImages ?? true,
        completeYoutubeIds: options.completeYoutubeIds ?? false,
      },
      (enhancedTracks) => {
        setTracks(enhancedTracks);
        setIsLoading(false);
        setIsEnhanced(true);

        // Llamar al callback de actualización si existe
        if (options.updateCallback) {
          options.updateCallback(enhancedTracks);
        }
      }
    );
  }, [pageType, sectionType, options, tracks]);

  // Mejorar tracks cuando cambien los tracks iniciales
  useEffect(() => {
    if (initialTracks.length > 0 && JSON.stringify(initialTracks) !== JSON.stringify(tracks)) {
      setTracks(initialTracks);
      setIsEnhanced(false);
      enhanceTracks(initialTracks);
    }
  }, [initialTracks]);

  // Función para ordenar los tracks por completitud
  const sortByCompleteness = useCallback(() => {
    if (!tracks.length) return;

    const sortedTracks = loadOrchestrator.sortTracksByCompleteness(tracks);
    setTracks(sortedTracks);
  }, [tracks]);

  return {
    tracks,
    isLoading,
    isEnhanced,
    enhanceTracks,
    sortByCompleteness,
  };
}
