'use client';

import React, { createContext, useState, useContext, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Cookies from 'js-cookie';
import { setDemoMode } from '@/services/spotify';

export interface AuthContextType {
  isAuthenticated: boolean;
  isDemo: boolean;
  loading: boolean;
  isLoading: boolean;
  toggleDemoMode: (forceState?: boolean) => void;
  logout: () => void;
  preferredLanguage: string;
  setPreferredLanguage: (lang: string) => void;
}

// Valor inicial por defecto para el contexto
export const defaultAuthContext: AuthContextType = {
  isAuthenticated: false,
  isDemo: false,
  loading: true,
  isLoading: true,
  toggleDemoMode: () => {},
  logout: () => {},
  preferredLanguage: 'es',
  setPreferredLanguage: () => {},
};

export const AuthContext = createContext<AuthContextType>(defaultAuthContext);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [isDemo, setIsDemo] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [preferredLanguage, setPreferredLanguage] = useState<string>('es');

  // Verificar si hay una sesión real antes de considerar activar el modo demo
  useEffect(() => {
    const checkDemoMode = async () => {
      setLoading(true);

      // Leer el estado del modo demo de las cookies (verificar ambas cookies)
      const isDemoMode = Cookies.get('demo-mode') === 'true' || Cookies.get('demoMode') === 'true';

      // Si hay una sesión real, desactivamos el modo demo forzosamente
      if (session) {
        if (isDemoMode) {
          console.log('[AuthProvider] Desactivando modo demo porque existe una sesión real');
          // Eliminar ambas cookies para mayor consistencia
          Cookies.remove('demo-mode', { path: '/' });
          Cookies.remove('demoMode', { path: '/' });
          setIsDemo(false);
          // Informar al servicio de Spotify que no estamos en modo demo
          setDemoMode(false);
        }
      } else {
        // Si no hay sesión, respetamos la cookie
        setIsDemo(isDemoMode);

        // Si está en modo demo, configurar el idioma adecuado y sincronizar cookies
        if (isDemoMode) {
          const demoLang = Cookies.get('demoLanguage') || 'es';
          setPreferredLanguage(demoLang);

          // Asegurar que ambas cookies están configuradas
          Cookies.set('demo-mode', 'true', { expires: 7, path: '/' });
          Cookies.set('demoMode', 'true', { expires: 7, path: '/' });

          // Informar al servicio de Spotify que estamos en modo demo
          setDemoMode(true, demoLang);
          console.log(`[AuthProvider] Modo demo activado con idioma: ${demoLang}`);
        }
      }

      setLoading(false);
    };

    checkDemoMode();
  }, [session]);

  // Cambiar el idioma preferido
  const handleSetPreferredLanguage = (lang: string) => {
    setPreferredLanguage(lang);

    // Si estamos en modo demo, también guardar el idioma en una cookie
    if (isDemo) {
      Cookies.set('demoLanguage', lang, { expires: 7 });
      // Actualizar el idioma en el servicio de Spotify
      setDemoMode(true, lang);
    }
  };

  const toggleDemoMode = (forceState?: boolean) => {
    // Si hay una sesión real, no permitir activar el modo demo
    if (session && (forceState === true || (forceState === undefined && !isDemo))) {
      console.warn('[AuthProvider] No se puede activar el modo demo con una sesión real');
      return;
    }

    const newDemoState = forceState !== undefined ? forceState : !isDemo;
    setIsDemo(newDemoState);

    if (newDemoState) {
      // Usar el mismo nombre de cookie que el middleware espera: 'demo-mode'
      Cookies.set('demo-mode', 'true', { expires: 7, path: '/' });
      // También mantener la anterior para compatibilidad
      Cookies.set('demoMode', 'true', { expires: 7, path: '/' });
      // Establecer el idioma por defecto para el modo demo
      Cookies.set('demoLanguage', preferredLanguage, { expires: 7, path: '/' });
      // Informar al servicio de Spotify que estamos en modo demo
      setDemoMode(true, preferredLanguage);
      console.log(`[AuthProvider] Modo demo activado con idioma: ${preferredLanguage}`);
    } else {
      Cookies.remove('demo-mode', { path: '/' });
      Cookies.remove('demoMode', { path: '/' });
      // Informar al servicio de Spotify que no estamos en modo demo
      setDemoMode(false);
      console.log('[AuthProvider] Modo demo desactivado');
    }
  };

  // Verificar al inicio si existe cookie de modo demo pero no está reflejada en el estado
  useEffect(() => {
    // Solo si no estamos cargando y no tenemos modo demo activo en el estado
    if (!loading && !isDemo) {
      const isDemoModeFromCookie =
        document.cookie.includes('demo-mode=true') ||
        document.cookie.includes('demoMode=true');

      if (isDemoModeFromCookie) {
        console.log('[AuthProvider] Detectada cookie de modo demo, sincronizando estado');
        // Activar modo demo sin cambiar cookies
        setIsDemo(true);
        // Obtener idioma preferido de la cookie
        const demoLang = Cookies.get('demoLanguage') || 'es';
        setPreferredLanguage(demoLang);
        // Informar al servicio
        setDemoMode(true, demoLang);
      }
    }
  }, [loading, isDemo]);

  const logout = () => {
    // Si estamos en modo demo, desactivarlo
    if (isDemo) {
      toggleDemoMode(false);
      // Redirigir a la página de inicio
      window.location.href = '/';
    } else {
      // Si es una sesión real, usar signOut de next-auth
      signOut({ callbackUrl: '/login' });
    }
  };

  const contextValue: AuthContextType = {
    isAuthenticated: !!session || isDemo,
    isDemo,
    loading,
    isLoading: loading,
    toggleDemoMode,
    logout,
    preferredLanguage,
    setPreferredLanguage: handleSetPreferredLanguage,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);

  // No lanzar error si el contexto no existe, devolver valores por defecto
  // Esto ayuda durante SSR y compilación estática
  if (!context) {
    console.warn('useAuth fue llamado fuera de un AuthProvider. Usando valores por defecto.');
    return defaultAuthContext;
  }

  return context;
};
