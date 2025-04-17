'use client';

import { ReactNode } from 'react';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/useAuth';

// Rutas públicas que no requieren autenticación
const publicRoutes = ['/login', '/register'];

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    // Si la autenticación está cargando, no hacer nada todavía
    if (isLoading) return;
    
    // Si la ruta es pública, permitir el acceso sin verificar autenticación
    if (pathname && publicRoutes.includes(pathname)) return;
    
    // Si no está autenticado y no es una ruta pública, redirigir al login
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [router, isAuthenticated, isLoading, pathname]);

  // Si la ruta es pública, mostrar el contenido independientemente del estado de autenticación
  if (pathname && publicRoutes.includes(pathname)) {
    return <>{children}</>;
  }

  // Si está cargando, mostrar un indicador de carga
  if (isLoading) {
    return <div>Cargando...</div>;
  }

  // Si está autenticado o la ruta es pública, mostrar el contenido
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // Por defecto, mostrar un mensaje mientras se redirige
  return <div>Redirigiendo al login...</div>;
} 