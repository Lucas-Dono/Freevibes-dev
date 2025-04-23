"use client";

import React, { useEffect, useState } from 'react';
import { Box, Container, CssBaseline, ThemeProvider, createTheme, useTheme, useMediaQuery, Alert } from '@mui/material';
import { Navbar } from '@/components/Navbar';
import { PlayerBar } from '@/components/PlayerBar';
import { MobilePlayerBar } from '@/components/player/MobilePlayerBar';
import AuthProvider from './providers/AuthProvider';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { PlayerProvider } from '@/contexts/PlayerContext';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Toaster } from 'react-hot-toast';

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
  const searchParams = useSearchParams();
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Estado para el modo demo
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [demoLang, setDemoLang] = useState<string>('es');

  // Rutas públicas que no requieren autenticación
  const publicRoutes = ['/login', '/register', '/reset-password'];
  const isPublicRoute = pathname ? publicRoutes.includes(pathname) : false;

  // Efecto para capturar el token de refresh desde la URL
  useEffect(() => {
    console.log('ClientLayout: Verificando parámetros de URL para token de refresco...');

    // Verificar si hay un token en la URL
    const rtData = searchParams?.get('rt_data');

    if (rtData) {
      console.log('ClientLayout: Token encontrado en URL, procesando...');
      try {
        // Decodificar el token desde base64
        const refreshToken = atob(rtData);
        console.log('ClientLayout: Token de refresh capturado desde URL (length):', refreshToken.length);

        // Guardar en localStorage
        localStorage.setItem('spotify_refresh_token', refreshToken);
        console.log('ClientLayout: Token guardado en localStorage correctamente');

        // Verificar que realmente se guardó
        const savedToken = localStorage.getItem('spotify_refresh_token');
        if (savedToken) {
          console.log('ClientLayout: Verificación exitosa, token guardado (length):', savedToken.length);
        } else {
          console.error('ClientLayout: Error - El token no se guardó correctamente en localStorage');
        }

        // Limpiar la URL para no exponer el token
        console.log('ClientLayout: Limpiando URL...');
        const newUrl = window.location.pathname;
        router.replace(newUrl);
      } catch (error) {
        console.error('ClientLayout: Error al procesar token desde URL:', error);

        // Intentar limpiar la URL de todos modos
        try {
          router.replace(window.location.pathname);
        } catch (routerError) {
          console.error('ClientLayout: Error secundario al limpiar URL:', routerError);
        }
      }
    } else {
      console.log('ClientLayout: No se encontró token en la URL');

      // Verificar si ya tenemos un token en localStorage
      const existingToken = localStorage.getItem('spotify_refresh_token');
      if (existingToken) {
        console.log('ClientLayout: Token existente en localStorage (length):', existingToken.length);
      } else {
        console.log('ClientLayout: No hay token en localStorage');
      }
    }
  }, [searchParams, router]);

  // Efecto para verificar si el modo demo está activo
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const demoMode = sessionStorage.getItem('demoMode') === 'true';
      const lang = sessionStorage.getItem('demoLang') || 'es';

      setIsDemoMode(demoMode);
      setDemoLang(lang);

      if (demoMode) {
        console.log(`[DEMO] Modo demo activo con idioma: ${lang}`);
      }
    }
  }, [pathname]); // Re-verificar cuando cambia la ruta

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <AuthProvider>
        <NotificationProvider>
          <PlayerProvider>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: '100vh',
                bgcolor: isPublicRoute ? 'transparent' : 'background.default',
                color: 'text.primary',
                position: 'relative',
                pb: !isPublicRoute ? '90px' : 0,
              }}
            >
              {isDemoMode && !isPublicRoute && (
                <Box
                  sx={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 9999,
                    bgcolor: 'rgba(138, 43, 226, 0.8)', // Violeta semi-transparente
                    py: 0.5,
                    backdropFilter: 'blur(4px)',
                  }}
                >
                  <Container>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <svg className="w-5 h-5" fill="white" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                          <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm font-medium text-white">
                          Modo Demo ({demoLang === 'es' ? 'Español' : demoLang === 'en' ? 'English' : demoLang === 'fr' ? 'Français' : 'Italiano'})
                        </span>
                      </Box>
                      <button
                        onClick={() => {
                          sessionStorage.removeItem('demoMode');
                          sessionStorage.removeItem('demoLang');
                          setIsDemoMode(false);
                          router.push('/login');
                        }}
                        className="text-xs text-white hover:text-gray-200 bg-purple-900 hover:bg-purple-950 px-2 py-1 rounded-md"
                      >
                        Salir del demo
                      </button>
                    </Box>
                  </Container>
                </Box>
              )}
              {!isPublicRoute && <Navbar />}
              <Box
                component="main"
                sx={{
                  flexGrow: 1,
                  mt: isPublicRoute ? 0 : (isDemoMode ? '100px' : '64px'), // Sin margen en rutas públicas
                  pt: isPublicRoute ? 0 : 2,
                  px: isPublicRoute ? 0 : { xs: 1, sm: 3 },
                }}
              >
                <Container maxWidth={isPublicRoute ? false : "xl"} disableGutters={isPublicRoute}>
                  {children}
                </Container>
              </Box>
              {!isPublicRoute && (isMobile ? <MobilePlayerBar /> : <PlayerBar />)}
            </Box>
            <Toaster position="bottom-right" />
          </PlayerProvider>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default ClientLayout;
