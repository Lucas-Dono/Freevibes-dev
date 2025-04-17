import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { Box, CircularProgress, Typography } from '@mui/material';

// Rutas públicas que no requieren autenticación
const publicRoutes = ['/login', '/register', '/'];

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoading, isAuthenticated, isDemo } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Si está cargando, no hacer nada todavía
    if (isLoading) return;

    // Si es una ruta pública, no necesitamos verificar autenticación
    if (pathname && publicRoutes.includes(pathname)) return;

    // Si no está autenticado y no es una ruta pública, redirigir a login
    if (!isAuthenticated && pathname && !publicRoutes.includes(pathname)) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, pathname, router]);

  // Si está cargando, mostrar indicador de carga
  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <CircularProgress color="primary" />
        <Typography variant="body1" color="text.secondary">
          Cargando...
        </Typography>
      </Box>
    );
  }

  // Si es una ruta pública o el usuario está autenticado, mostrar la página
  if ((pathname && publicRoutes.includes(pathname)) || isAuthenticated) {
    return <>{children}</>;
  }

  // En cualquier otro caso, mostrar un indicador mientras se redirige
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
      }}
    >
      <Typography variant="body1" color="text.secondary">
        Redirigiendo...
      </Typography>
    </Box>
  );
};

export default ProtectedRoute; 