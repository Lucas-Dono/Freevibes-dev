'use client';

import { useEffect, useState } from 'react';

interface YouTubeInitializerProps {
  onReady?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Componente que se encarga de inicializar la API de YouTube de forma confiable
 * y notificar cuando está lista para usar
 */
export default function YouTubeInitializer({ onReady, onError }: YouTubeInitializerProps) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Si YT ya está disponible, marcamos como cargado
    if (window.YT && window.YT.Player) {
      console.log('[YouTubeInitializer] API de YouTube ya está disponible');
      setLoaded(true);
      onReady?.();
      return;
    }

    // Si el script ya existe pero no está listo, configuramos el callback
    if (document.getElementById('youtube-iframe-api-script')) {
      console.log('[YouTubeInitializer] Script de YouTube ya existe, esperando callback');

      // Configurar el callback global
      window.onYouTubeIframeAPIReady = () => {
        console.log('[YouTubeInitializer] API de YouTube inicializada (callback existente)');
        setLoaded(true);
        onReady?.();
      };

      return;
    }

    // Si no existe, creamos el script manualmente
    console.log('[YouTubeInitializer] Creando script de YouTube manualmente');

    try {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.id = 'youtube-iframe-api-script';

      // Configurar el callback global
      window.onYouTubeIframeAPIReady = () => {
        console.log('[YouTubeInitializer] API de YouTube inicializada (callback nuevo)');
        setLoaded(true);
        onReady?.();
      };

      // Insertar el script en el DOM
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      // Timeout para detectar problemas
      const timeoutId = setTimeout(() => {
        if (!window.YT || !window.YT.Player) {
          console.error('[YouTubeInitializer] Timeout esperando la API de YouTube');
          const error = new Error('Timeout esperando la API de YouTube');
          onError?.(error);
        }
      }, 10000);

      return () => {
        clearTimeout(timeoutId);
      };
    } catch (error) {
      console.error('[YouTubeInitializer] Error al cargar script de YouTube:', error);
      onError?.(error as Error);
    }
  }, [onReady, onError]);

  return null; // Este componente no renderiza nada
}

// Definición del tipo global para TypeScript
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | null;
  }
}
