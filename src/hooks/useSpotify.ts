'use client';

import { useEffect, useState, useContext } from "react";
import { useSession, signIn } from 'next-auth/react';
import { AuthContext } from '../components/providers/AuthProvider';
import useLocalStorage from './useLocalStorage';
import { useAuth } from '@/components/providers/AuthProvider';

/**
 * Función para eliminar todas las cookies relacionadas con el modo demo
 * y forzar la restauración del estado original
 */
function forceClearDemoMode() {
  console.log('[useSpotify] Forzando limpieza completa del modo demo');
  
  // Eliminar todas las cookies relacionadas
  document.cookie = 'demoMode=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  document.cookie = 'demoLang=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  document.cookie = 'next-auth.session-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  document.cookie = 'next-auth.callback-url=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  document.cookie = 'next-auth.csrf-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  
  // Limpiar localStorage
  localStorage.removeItem('demoMode');
  localStorage.removeItem('localSpotifyDemoMode');
  
  // Limpiar sessionStorage
  sessionStorage.removeItem('demoMode');
  sessionStorage.removeItem('demoLang');
  
  // Establecer la bandera global para forzar desactivación
  window.__FORCE_DISABLE_DEMO__ = true;
  
  console.log('[useSpotify] Limpieza completa realizada, recargando página...');
  
  // Forzar recarga completa de la página sin caché
  window.location.href = window.location.href.split('?')[0] + '?forcenodemo=true&t=' + new Date().getTime();
}

/**
 * Hook personalizado para acceder a la sesión de Spotify
 * Proporciona la sesión y un indicador de si está cargando
 */
export default function useSpotify() {
  const { data: session, status } = useSession();
  const auth = useAuth(); // Ahora useAuth ya no retorna null, así que no necesitamos comprobaciones
  const isAuthenticated = !!session || auth.isDemo;
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (session) {
      setIsLoading(false);
    } else if (status !== 'loading') {
      setIsLoading(false);
    }

    // Verificar si hay una bandera global para forzar la desactivación del modo demo
    if (typeof window !== 'undefined' && window.__FORCE_DISABLE_DEMO__ && auth.isDemo) {
      console.log('[useSpotify] Desactivando modo demo debido a bandera global');
      auth.toggleDemoMode(false);
    }
  }, [session, status, auth]);

  const login = () => {
    signIn('spotify', { callbackUrl: '/' });
  };

  return {
    session,
    status,
    isAuthenticated,
    isLoading,
    login,
    isDemo: auth.isDemo
  };
} 