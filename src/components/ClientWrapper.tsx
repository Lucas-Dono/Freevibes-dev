'use client';

import React, { useEffect, useState } from 'react';
import { SessionProvider } from 'next-auth/react';
import { PlayerProvider } from '@/contexts/PlayerContext';
import ClientLayout from '@/components/ClientLayout';
import AuthProvider from '@/components/providers/AuthProvider';
import { suppressConsoleMessages, ErrorBoundary, setDebugMode } from '@/lib/errorUtils';
import LanguageProvider from '@/contexts/LanguageContext';
import YouTubeInitializer from './YouTubeInitializer';
import ServerLoadingModal from './ServerLoadingModal';

interface ClientWrapperProps {
  children: React.ReactNode;
}

// Función para verificar si es la primera visita (usando localStorage)
const checkFirstVisit = (): boolean => {
  if (typeof window !== 'undefined') {
    const isFirst = localStorage.getItem('freevibes_first_visit') === null;
    if (isFirst) {
      localStorage.setItem('freevibes_first_visit', 'no');
    }
    return isFirst;
  }
  return true; // Asumir primera visita si no hay window
};

const ClientWrapper: React.FC<ClientWrapperProps> = ({ children }) => {
  const [youtubeReady, setYoutubeReady] = useState(false);
  const [youtubeError, setYoutubeError] = useState<string | null>(null);
  // Estado para controlar la visibilidad del modal
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);

  useEffect(() => {
    // Activar modo debug si es necesario (ej. localhost)
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      setDebugMode(true);
    } else {
      // Desactivar logs en producción para una consola más limpia
      // suppressConsoleMessages();
    }

    // Mostrar el modal solo en la primera visita (después de la carga inicial)
    // para dar tiempo a los servidores gratuitos a iniciarse.
    // En visitas posteriores, asumimos que el usuario entiende que puede haber
    // una pequeña espera si los servidores están dormidos.
    const isFirst = checkFirstVisit();
    console.log(`[ClientWrapper] ¿Es la primera visita? ${isFirst}`);
    setIsServerModalOpen(isFirst);

  }, []);

  const handleYouTubeReady = () => {
    console.log('YouTube API lista.');
    setYoutubeReady(true);
    setYoutubeError(null);
  };

  const handleYouTubeError = (error: Error) => {
    console.error('Error al inicializar YouTube API:', error.message);
    setYoutubeReady(false);
    setYoutubeError(error.message);
  };

  return (
    <ErrorBoundary>
      {/* Inicializador de YouTube que se encarga de cargar la API */}
      <YouTubeInitializer 
        onReady={handleYouTubeReady} 
        onError={handleYouTubeError} 
      />
      
      {/* Envolvemos todo en el SessionProvider para que useSession funcione */}
      <SessionProvider>
        <LanguageProvider>
          <AuthProvider>
            <PlayerProvider youtubeReady={youtubeReady}>
              <ClientLayout>{children}</ClientLayout>
              <ServerLoadingModal 
                isOpen={isServerModalOpen} 
                onClose={() => setIsServerModalOpen(false)} 
              />
            </PlayerProvider>
          </AuthProvider>
        </LanguageProvider>
      </SessionProvider>
    </ErrorBoundary>
  );
};

export default ClientWrapper; 