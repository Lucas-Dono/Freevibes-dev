'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Box, CircularProgress } from '@mui/material';

export default function ProfileRedirectPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirigir a la página de géneros
    router.push('/profile/genres');
  }, [router]);
  
  return (
    <Box sx={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh' 
    }}>
      <CircularProgress color="secondary" />
    </Box>
  );
} 