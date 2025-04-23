'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';

interface AuthRequiredProps {
  children: React.ReactNode;
}

export default function AuthRequired({ children }: AuthRequiredProps) {
  const { isAuthenticated, isLoading, isDemo } = useAuth();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Si ya sabemos que estamos en modo demo, permitir acceso inmediatamente
    if (isDemo) {
      console.log('[AuthRequired] Modo demo detectado, permitiendo acceso');
      setIsChecking(false);
      return;
    }

    // Para evitar verificaciones repetidas y bucles
    const lastChecked = sessionStorage.getItem('lastAuthCheck');
    const now = Date.now();

    if (lastChecked && now - parseInt(lastChecked) < 2000) {
      console.log('[AuthRequired] Verificación reciente, omitiendo');
      setIsChecking(false);
      return;
    }

    // Registrar esta verificación
    sessionStorage.setItem('lastAuthCheck', now.toString());

    // Solo verificar cuando el estado de autenticación ya no está cargando
    if (!isLoading) {
      console.log('[AuthRequired] Estado de autenticación:', isAuthenticated ? 'autenticado' : 'no autenticado');

      if (!isAuthenticated && !isDemo) {
        console.log('[AuthRequired] No hay autenticación, redirigiendo a login');
        // Solo redirigir si no estamos ya en login para evitar bucles
        if (window.location.pathname !== '/login') {
          router.push('/login');
        }
      } else {
        console.log('[AuthRequired] Autenticación válida, permitiendo acceso');
      }

      setIsChecking(false);
    }
  }, [isAuthenticated, isLoading, isDemo, router]);

  // Mostrar un indicador de carga mientras verificamos la autenticación
  if (isChecking || (isLoading && !isDemo)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gradient-to-b from-blue-900 to-black">
        <div className="h-16 w-16 animate-spin rounded-full border-b-2 border-t-2 border-blue-500"></div>
      </div>
    );
  }

  // Si no hay autenticación pero estamos en modo demo, permitir acceso
  if (!isAuthenticated && isDemo) {
    return <>{children}</>;
  }

  // Si no hay autenticación ni modo demo, no renderizar nada mientras se redirige
  if (!isAuthenticated && !isDemo) {
    return null;
  }

  // Si hay autenticación, renderizar los hijos
  return <>{children}</>;
}
