'use client';

import React, { useEffect } from 'react';
import { Box, Typography, Button, Container } from '@mui/material';
import { useRouter } from 'next/navigation';

export default function NotFound() {
  const router = useRouter();

  // En el lado del cliente, podemos usar los hooks de React sin problemas
  useEffect(() => {
    // Podríamos cargar datos o realizar acciones una vez que estamos en el cliente
  }, []);

  return (
    <Container
      maxWidth="md"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        py: 8,
        textAlign: 'center'
      }}
    >
      <Typography variant="h1" component="h1" sx={{ fontSize: { xs: '3rem', sm: '4rem' }, mb: 2 }}>
        404
      </Typography>
      <Typography variant="h4" component="h2" sx={{ mb: 3 }}>
        Página no encontrada
      </Typography>
      <Typography variant="body1" sx={{ mb: 4, maxWidth: '600px' }}>
        La página que estás buscando no existe o ha sido movida.
      </Typography>
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={() => router.push('/')}
        >
          Volver al inicio
        </Button>
        <Button
          variant="outlined"
          onClick={() => router.back()}
        >
          Volver atrás
        </Button>
      </Box>
    </Container>
  );
}
