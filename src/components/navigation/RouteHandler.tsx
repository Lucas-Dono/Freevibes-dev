'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { loadOrchestrator } from '@/services/orchestration';
import { getPageTypeFromPath, getPrimarySection } from '@/lib/navigation-map';

/**
 * Componente que detecta cambios en la ruta y configura las prioridades de carga
 * Debe colocarse cerca de la raíz de la aplicación para detectar todos los cambios de ruta
 */
export default function RouteHandler() {
  const pathname = usePathname();
  
  useEffect(() => {
    if (!pathname) return;
    
    // Detectar la página y sección actual
    const pageType = getPageTypeFromPath(pathname);
    const primarySection = getPrimarySection(pathname);
    
    // Establecer prioridad en el orquestador de carga
    loadOrchestrator.setPriority(pageType, primarySection);
    
  }, [pathname]);
  
  // Este componente no renderiza nada visual, solo gestiona la lógica de navegación
  return null;
} 