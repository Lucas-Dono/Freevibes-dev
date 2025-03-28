import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import { Box, CircularProgress, Typography } from '@mui/material';

// Rutas públicas que no requieren autenticación
const publicRoutes = ['/login', '/register', '/api/auth/spotify/callback'];

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading: loading, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    console.log('Estado actual:', { user, loading, pathname, isAuthenticated });
    
    if (loading) return;

    const isPublicRoute = pathname && publicRoutes.includes(pathname);
    
    if (!isAuthenticated && !isPublicRoute) {
      console.log('Redirigiendo a login - usuario no autenticado');
      router.push('/login');
      return;
    }

    if (isAuthenticated && isPublicRoute) {
      console.log('Redirigiendo a home - usuario ya autenticado');
      router.push('/home');
      return;
    }
  }, [user, loading, pathname, router, isAuthenticated]);

  // Si está cargando, mostrar indicador de carga
  if (loading) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          backgroundColor: '#0F0F18'
        }}
      >
        <CircularProgress color="secondary" size={50} />
        <Typography variant="body1" color="white" sx={{ mt: 2 }}>
          Cargando...
        </Typography>
      </Box>
    );
  }

  // Si no está autenticado y no es una ruta pública, mostrar pantalla de carga
  if (!isAuthenticated && pathname && !publicRoutes.includes(pathname)) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          backgroundColor: '#0F0F18'
        }}
      >
        <CircularProgress color="secondary" size={50} />
        <Typography variant="body1" color="white" sx={{ mt: 2 }}>
          Verificando autenticación...
        </Typography>
      </Box>
    );
  }

  // Si está autenticado o es una ruta pública, renderizar los componentes hijos
  return <>{children}</>;
};

export default ProtectedRoute; 