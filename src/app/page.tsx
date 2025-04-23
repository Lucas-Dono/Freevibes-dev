'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CircularProgress, Box, Typography } from '@mui/material';
import { APP_NAME } from '@/app/config';

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    router.push('/home');
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
        {APP_NAME}
      </Typography>
      <CircularProgress color="secondary" />
      <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
        Redirigiendo...
      </Typography>
    </Box>
  );
}
