'use client';

import React, { createContext, useContext, ReactNode, useCallback, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Cookies from 'js-cookie';

// Interfaz para el contexto de navegación
interface NavigationContextType {
  /**
   * Navegar a una ruta específica
   * @param route La ruta a la que navegar
   * @param options Opciones adicionales
   */
  navigateTo: (route: string, options?: NavigationOptions) => void;
  
  /**
   * Refrescar la página actual
   */
  refreshPage: () => void;
  
  /**
   * Indica si actualmente se está navegando
   */
  isNavigating: boolean;
}

// Opciones para la navegación
interface NavigationOptions {
  forceRefresh?: boolean; // Si es true, fuerza un refresco completo
  useLocation?: boolean;  // Si es true, usa window.location en lugar de router
  skipAuthCheck?: boolean; // Si es true, no verifica autenticación
}

// Rutas problemáticas conocidas que requieren manejo especial
const problematicRoutes = ['/explore', '/search', '/library'];

// Crear el contexto
const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

// Proveedor del contexto
export function NavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);
  
  // Verificar autenticación en caso de página inválida
  useEffect(() => {
    // Verificamos si estamos autenticados pero vemos una página que requiere login
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    const isAuthError = currentPath.includes('?error=unauthorized') || 
                       currentPath.includes('?error=authentication');
    
    if (isAuthError) {
      console.log('[Navigation] Detectado error de autenticación en URL, forzando renovación de token');
      fetch('/api/auth/spotify/refresh')
        .then(res => {
          if (res.ok) {
            // Si el token se renovó, redirigir a la misma ruta sin el error
            window.location.href = currentPath.split('?')[0];
          }
        })
        .catch(err => console.error('[Navigation] Error al renovar token:', err));
    }
  }, [pathname]);

  // Función para navegar a una ruta específica
  const navigateTo = useCallback((route: string, options?: NavigationOptions) => {
    // Valores por defecto
    const { forceRefresh = false, useLocation = false, skipAuthCheck = false } = options || {};
    
    setIsNavigating(true);
    
    // Verificar si ya estamos en esta ruta
    if (typeof window !== 'undefined' && window.location.pathname === route) {
      console.log(`[Navigation] Ya estamos en la ruta: ${route}, solo refrescando`);
      router.refresh();
      setIsNavigating(false);
      return;
    }
    
    // Verificar si estamos en un ciclo de redirección potencial
    const lastNavigation = sessionStorage.getItem('last_navigation');
    const lastNavigationTime = sessionStorage.getItem('last_navigation_time');
    const now = Date.now();
    
    if (lastNavigation === route && lastNavigationTime && now - parseInt(lastNavigationTime) < 2000) {
      console.warn(`[Navigation] Detectado posible ciclo de redirección a: ${route}. Rompiendo el ciclo.`);
      setIsNavigating(false);
      return;
    }
    
    // Si no estamos saltando la verificación de autenticación, verificar token
    if (!skipAuthCheck) {
      const hasSpotifyToken = !!Cookies.get('spotify_access_token');
      
      // Si no hay token y es una ruta que requiere autenticación, forzar uso de window.location
      // para que el middleware maneje correctamente la redirección
      if (!hasSpotifyToken && !route.startsWith('/login') && !route.startsWith('/register')) {
        console.log(`[Navigation] Sin token intentando navegar a: ${route}, usando window.location`);
        window.location.href = route;
        return;
      }
    }
    
    // Marcar la ruta como problemática si coincide con nuestras rutas conocidas
    const isProblematicRoute = problematicRoutes.some(problematicRoute => 
      route === problematicRoute || route.startsWith(`${problematicRoute}/`)
    );
    
    // Forzar uso de window.location para rutas problemáticas
    const shouldUseLocation = useLocation || isProblematicRoute || forceRefresh;
    
    // Actualizar el registro de navegación
    sessionStorage.setItem('last_navigation', route);
    sessionStorage.setItem('last_navigation_time', now.toString());
    
    // Determinar si debemos forzar un refresco completo
    if (shouldUseLocation) {
      // Usar window.location para una navegación completa (recarga la página)
      console.log(`[Navigation] Navegando a: ${route} con recarga completa`);
      window.location.href = route;
    } else {
      // Usar el router de Next.js para una navegación SPA
      console.log(`[Navigation] Navegando a: ${route} con router`);
      router.push(route);
      
      // Refrescar el router para evitar problemas de caché
      setTimeout(() => {
        router.refresh();
        setIsNavigating(false);
      }, 100);
    }
  }, [router]);

  // Función para refrescar la página actual
  const refreshPage = useCallback(() => {
    console.log('[Navigation] Refrescando página');
    router.refresh();
  }, [router]);

  // Valores del contexto
  const value = {
    navigateTo,
    refreshPage,
    isNavigating
  };

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}

// Hook para usar el contexto
export function useNavigation() {
  const context = useContext(NavigationContext);
  
  if (context === undefined) {
    throw new Error('useNavigation debe ser usado dentro de un NavigationProvider');
  }
  
  return context;
} 