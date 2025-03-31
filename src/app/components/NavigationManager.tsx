'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/**
 * Componente que maneja la navegación y resuelve problemas de caché en las rutas
 * Esto es vital para aplicaciones que utilizan exportación estática o tienen problemas
 * de redirección en Next.js
 */
const NavigationManager = () => {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detectar discrepancias entre pathname y URL real
    const handleRouteChange = () => {
      const currentUrl = window.location.pathname;
      
      // Si hay una discrepancia entre la URL real y la ruta de Next.js
      if (currentUrl !== pathname && currentUrl !== '/' && currentUrl !== '/home') {
        console.log(`[NavigationManager] Detectada discrepancia: URL=${currentUrl}, Ruta=${pathname}`);
        
        // NO forzar redirección para rutas conocidas como /explore, /search, /library
        // o cualquier subruta de estas secciones
        const knownRoutes = ['/explore', '/search', '/library'];
        const isKnownRoute = knownRoutes.some(route => 
          currentUrl === route || currentUrl.startsWith(`${route}/`)
        );
        
        if (!isKnownRoute) {
          console.log(`[NavigationManager] Corrigiendo discrepancia: URL=${currentUrl}, Ruta=${pathname}`);
          // Forzar la navegación correcta y refrescar caché
          setTimeout(() => {
            window.location.href = currentUrl;
          }, 10);
        } else {
          console.log(`[NavigationManager] Ignorando discrepancia para ruta conocida: ${currentUrl}`);
        }
      }
    };

    // Ejecutar inmediatamente
    handleRouteChange();

    // Monitorear cambios en la URL
    window.addEventListener('popstate', handleRouteChange);
    return () => {
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, [pathname]);

  // Añadir limpieza de caché periódica
  useEffect(() => {
    // Limpiar caché del router periódicamente
    const refreshInterval = setInterval(() => {
      router.refresh();
    }, 60000); // Cada minuto
    
    return () => clearInterval(refreshInterval);
  }, [router]);

  // Este componente no renderiza nada visible
  return null;
};

export default NavigationManager; 