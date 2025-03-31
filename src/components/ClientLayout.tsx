"use client";

import React from 'react';
import { Box, Container, CssBaseline, ThemeProvider, createTheme, useTheme, useMediaQuery } from '@mui/material';
import { Navbar } from '@/components/Navbar';
import { PlayerBar } from '@/components/PlayerBar';
import { MobilePlayerBar } from '@/components/player/MobilePlayerBar';
import { AuthProvider } from '@/app/context/AuthContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';
import { NavigationProvider } from '@/app/context/NavigationContext';

// Importar el componente NavigationManager de forma dinámica
const NavigationManager = dynamic(() => import('../app/components/NavigationManager'), {
  ssr: false
});

// Import PlayerProvider dinámicamente para evitar renderizado en el servidor
const DynamicPlayerProvider = dynamic(
  () => import('@/contexts/PlayerContext').then(mod => ({ default: mod.PlayerProvider })),
  { ssr: false }
);

// Tema oscuro para toda la aplicación
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#7c4dff',
    },
    secondary: {
      main: '#b388ff',
    },
    background: {
      default: '#0f0f18',
      paper: '#1a1a2e',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarWidth: 'thin',
          '&::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: '#1a1a2e',
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#3f3f5f',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: '#525273',
          },
        },
      },
    },
  },
});

// Componente Cliente para el Layout
const ClientLayout = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // Rutas públicas que no requieren autenticación
  const publicRoutes = ['/login', '/register', '/reset-password'];
  const isPublicRoute = pathname ? publicRoutes.includes(pathname) : false;

  // Verificar que la URL del navegador coincida con la ruta actual
  useEffect(() => {
    // Esta función verifica si la URL visible en el navegador coincide con la ruta real
    // y redirige correctamente si es necesario
    const checkAndRedirect = () => {
      if (typeof window !== 'undefined') {
        const browserPath = window.location.pathname;
        
        // Si estamos en el cliente y la ruta del navegador no coincide con la ruta de Next.js
        // y no estamos en la página de inicio, entonces redirigimos
        if (browserPath !== '/' && browserPath !== '/home' && pathname === '/home') {
          console.log('Redirigiendo desde ClientLayout:', browserPath);
          router.push(browserPath);
        }
      }
    };
    
    checkAndRedirect();
  }, [pathname, router]);

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <NavigationProvider>
        <AuthProvider>
          <NotificationProvider>
            <DynamicPlayerProvider>
              <NavigationManager />
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: '100vh',
                  bgcolor: 'background.default',
                  color: 'text.primary',
                  position: 'relative',
                  pb: !isPublicRoute ? '90px' : 0,
                }}
              >
                <Navbar />
                <Box 
                  component="main" 
                  sx={{ 
                    flexGrow: 1,
                    mt: '64px', // Altura de la barra de navegación
                    pt: 2,
                    px: { xs: 1, sm: 3 },
                  }}
                >
                  <Container maxWidth="xl">
                    {children}
                  </Container>
                </Box>
                {!isPublicRoute && (isMobile ? <MobilePlayerBar /> : <PlayerBar />)}
              </Box>
              <Toaster position="bottom-right" />
            </DynamicPlayerProvider>
          </NotificationProvider>
        </AuthProvider>
      </NavigationProvider>
    </ThemeProvider>
  );
};

export default ClientLayout; 