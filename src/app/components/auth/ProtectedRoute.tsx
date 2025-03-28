'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';

// Rutas públicas que no requieren autenticación
const publicRoutes = ['/login', '/register'];

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading) {
      const isPublicRoute = publicRoutes.includes(pathname);
      
      // Si no está autenticado y no es una ruta pública, redirigir a login
      if (!isAuthenticated && !isPublicRoute) {
        router.push('/login');
      }
      
      // Si está autenticado y está en una ruta pública, redirigir a home
      if (isAuthenticated && isPublicRoute) {
        router.push('/home');
      }
    }
  }, [isAuthenticated, isLoading, pathname, router]);

  // Si está cargando, muestra un spinner
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-900 to-black">
        <div className="h-16 w-16 animate-spin rounded-full border-b-2 border-t-2 border-blue-500"></div>
      </div>
    );
  }

  // Si es una ruta pública o está autenticado, muestra el contenido
  if (publicRoutes.includes(pathname) || isAuthenticated) {
    return <>{children}</>;
  }

  // En cualquier otro caso, no muestra nada mientras se redirige
  return null;
} 