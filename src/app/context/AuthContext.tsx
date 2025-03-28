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

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<SpotifyUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Verificar si el usuario está autenticado al cargar la página
  useEffect(() => {
    async function loadUserFromCookies() {
      setIsLoading(true);
      
      try {
        // Obtener información del usuario de la cookie
        const userDataCookie = Cookies.get('spotify_user');
        
        if (!userDataCookie) {
          // Si no hay cookie de usuario, el usuario no está autenticado
          if (pathname && pathname !== '/login' && !pathname.startsWith('/api/auth')) {
            router.push('/login');
          }
          setIsLoading(false);
          return;
        }
        
        // Parsear los datos del usuario
        const userData = JSON.parse(userDataCookie) as SpotifyUser;
        setUser(userData);
        
        // Verificar si el token de acceso está por expirar (menos de 5 minutos)
        const accessTokenExpires = Cookies.get('spotify_access_token_expires');
        const now = new Date().getTime();
        
        if (!accessTokenExpires || now > parseInt(accessTokenExpires) - 5 * 60 * 1000) {
          // Token expirado o por expirar, renovarlo
          const refreshResponse = await fetch('/api/auth/spotify/refresh');
          if (!refreshResponse.ok) {
            // Si la renovación falla, redirigir al login
            router.push('/login');
            setIsLoading(false);
            return;
          }
        }
      } catch (error) {
        console.error('Error loading user from cookies:', error);
        
        // Si hay un error, redirigir al login excepto si ya está en login
        if (pathname && pathname !== '/login' && !pathname.startsWith('/api/auth')) {
          router.push('/login');
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadUserFromCookies();
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