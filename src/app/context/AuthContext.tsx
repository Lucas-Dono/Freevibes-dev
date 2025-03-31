'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import axios from 'axios';
import Cookies from 'js-cookie';

interface SpotifyUser {
  id: string;
  name: string;
  email: string;
  images?: {
    url: string;
    height: number;
    width: number;
  }[];
}

interface AuthContextType {
  user: SpotifyUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

// Rutas especiales que no deberían ser redirigidas automáticamente
const specialRoutes = ['/explore', '/search', '/library', '/home', '/artist', '/album', '/playlist', '/profile', '/user'];

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<SpotifyUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Comprobar si una ruta es especial
  const isSpecialRoute = (path: string) => {
    return specialRoutes.some(route => 
      path === route || path.startsWith(`${route}/`)
    );
  };

  // Verificar si el usuario está autenticado al cargar la página
  useEffect(() => {
    let isMounted = true;
    
    async function loadUserFromCookies() {
      if (!isMounted) return;
      setIsLoading(true);
      
      try {
        // Obtener información del usuario de la cookie
        const userDataCookie = Cookies.get('spotify_user');
        const accessToken = Cookies.get('spotify_access_token');
        const refreshToken = Cookies.get('spotify_refresh_token');
        
        console.log('[Auth] Estado de cookies:', {
          hasUserData: !!userDataCookie,
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          currentPath: pathname
        });
        
        if (!userDataCookie || !accessToken || !refreshToken) {
          console.log('[Auth] Faltan cookies de autenticación');
          
          // Solo redirigir a login si no estamos en una ruta pública o en proceso de carga
          if (pathname && 
              pathname !== '/login' && 
              !pathname.startsWith('/api/auth') && 
              !pathname.startsWith('/register') && 
              !isSpecialRoute(pathname)) {
            // Esperar un momento antes de redirigir para evitar redirecciones durante la carga
            console.log(`[Auth] Redirigiendo a login desde ${pathname}`);
            setTimeout(() => {
              if (isMounted) {
                router.push('/login');
              }
            }, 500);
          }
          
          if (!isMounted) return;
          setIsLoading(false);
          return;
        }
        
        // Parsear los datos del usuario
        try {
          const userData = JSON.parse(userDataCookie) as SpotifyUser;
          if (!isMounted) return;
          setUser(userData);
        } catch (parseError) {
          console.error('[Auth] Error al parsear datos del usuario:', parseError);
          Cookies.remove('spotify_user');
        }
        
        // Verificar si el token de acceso está por expirar (menos de 5 minutos)
        const accessTokenExpires = Cookies.get('spotify_access_token_expires');
        const now = new Date().getTime();
        
        console.log('[Auth] Estado del token:', {
          expiresAt: accessTokenExpires,
          currentTime: now,
          timeUntilExpiry: accessTokenExpires ? parseInt(accessTokenExpires) - now : null
        });
        
        if (!accessTokenExpires || now > parseInt(accessTokenExpires) - 5 * 60 * 1000) {
          console.log('[Auth] Token expirado o por expirar, intentando renovar');
          // IMPORTANTE: Evitamos redirecciones aquí para permitir visualizar páginas
          // incluso si el token no se puede renovar inmediatamente
          try {
            const refreshResponse = await fetch('/api/auth/spotify/refresh');
            if (!refreshResponse.ok) {
              console.error('[Auth] Error al renovar token');
            } else {
              console.log('[Auth] Token renovado exitosamente');
            }
          } catch (refreshError) {
            console.error('[Auth] Error en solicitud de renovación:', refreshError);
          }
        }
      } catch (error) {
        console.error('[Auth] Error al cargar usuario:', error);
        
        // Si hay un error, solo redirigir a login en casos específicos
        if (pathname && 
            pathname !== '/login' && 
            !pathname.startsWith('/api/auth') && 
            !pathname.startsWith('/register') && 
            !isSpecialRoute(pathname)) {
          console.log(`[Auth] Redirigiendo a login desde ${pathname} debido a error`);
          router.push('/login');
        }
      }
      
      if (!isMounted) return;
      setIsLoading(false);
    }

    loadUserFromCookies();
    
    return () => {
      isMounted = false;
    };
  }, [pathname, router]);

  // Función para cerrar sesión
  const logout = () => {
    // Llamar a la API de logout y dejar que el servidor limpie las cookies
    window.location.href = '/api/auth/spotify/logout';
  };

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
} 