'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/**
 * Componente que maneja redirecciones cuando hay discrepancias entre
 * la URL del navegador y la ruta de Next.js, lo cual es común en
 * aplicaciones exportadas estáticamente o con problemas de enrutamiento.
 */
const RedirectHandler = () => {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Solo ejecutar en el cliente
    if (typeof window === 'undefined') return;

    // Obtener la ruta desde la URL del navegador
    const browserPath = window.location.pathname;
    
    // Comprobar si debemos redirigir
    const shouldRedirect = () => {
      // Si la URL del navegador es diferente a la ruta de Next.js actual
      // y no estamos en la página principal
      if (browserPath !== pathname && 
          browserPath !== '/' && 
          browserPath !== '/home' && 
          pathname === '/home') {
        return true;
      }
      return false;
    };

    // Realizar la redirección si es necesario
    if (shouldRedirect()) {
      console.log(`Redirigiendo: URL del navegador (${browserPath}) ≠ Ruta de Next.js (${pathname})`);
      router.push(browserPath);
    }
  }, [pathname, router]);

  // Este componente no renderiza nada visible
  return null;
};

export default RedirectHandler; 