'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CircularProgress, Box, Typography } from '@mui/material';

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      
      if (path !== '/' && path !== '/home' && path.length > 1) {
        console.log('[RootPage] Detectada URL específica:', path);
        
        window.location.href = path;
      } else {
        router.push('/home');
        
        setTimeout(() => {
          if (window.location.pathname === '/') {
            console.log('[RootPage] Forzando navegación a /home');
            window.location.href = '/home';
          }
        }, 300);
      }
    } else {
      router.push('/home');
    }
  }, [router]);

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        backgroundColor: '#0F0F18'
      }}
    >
      <Typography variant="h4" color="secondary" sx={{ mb: 4, fontWeight: 'bold' }}>
        MusicVerse
      </Typography>
      <CircularProgress color="secondary" />
      <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
        Redirigiendo...
      </Typography>
    </Box>
  );
} 