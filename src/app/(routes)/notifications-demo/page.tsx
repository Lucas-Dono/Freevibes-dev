'use client';

import React from 'react';
import { Box, Button, Container, Grid, Paper, Typography, Divider } from '@mui/material';
import { useCustomNotifications } from '@/hooks/useCustomNotifications';
import { motion } from 'framer-motion';

export default function NotificationsDemo() {
  const { 
    systemNotifications,
    libraryNotifications, 
    errorNotifications,
    showNotification,
    addSystemNotification
  } = useCustomNotifications();

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
          Demostración de Notificaciones
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 4 }}>
          Esta página muestra los diferentes tipos de notificaciones disponibles en la aplicación
        </Typography>
      </motion.div>

      <Grid container spacing={3}>
        {/* Notificaciones del sistema */}
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 2, bgcolor: 'background.paper', height: '100%' }}>
            <Typography variant="h6" gutterBottom>Notificaciones del sistema</Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Button 
                variant="outlined" 
                onClick={() => systemNotifications.onNewUpdate()}
                sx={{ justifyContent: 'flex-start' }}
              >
                Nueva actualización
              </Button>
              <Button 
                variant="outlined" 
                onClick={() => systemNotifications.onRecommendation('Descubre nuevos artistas similares')}
                sx={{ justifyContent: 'flex-start' }}
              >
                Recomendación
              </Button>
              <Button 
                variant="outlined" 
                onClick={() => systemNotifications.onNewRelease('Bad Bunny', 'Nuevo Álbum')}
                sx={{ justifyContent: 'flex-start' }}
              >
                Nuevo lanzamiento
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* Notificaciones personalizadas */}
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 2, bgcolor: 'background.paper', height: '100%' }}>
            <Typography variant="h6" gutterBottom>Notificaciones personalizadas</Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Button 
                variant="outlined" 
                onClick={() => addSystemNotification('Se creó tu playlist', 'success')}
                sx={{ justifyContent: 'flex-start' }}
              >
                Playlist creada
              </Button>
              <Button 
                variant="outlined" 
                onClick={() => addSystemNotification('Se actualizó tu playlist', 'info')}
                sx={{ justifyContent: 'flex-start' }}
              >
                Playlist actualizada
              </Button>
              <Button 
                variant="outlined" 
                onClick={() => addSystemNotification('Canción añadida a playlist', 'success')}
                sx={{ justifyContent: 'flex-start' }}
              >
                Canción añadida a playlist
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* Notificaciones de biblioteca */}
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 2, bgcolor: 'background.paper', height: '100%' }}>
            <Typography variant="h6" gutterBottom>Notificaciones de biblioteca</Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Button 
                variant="outlined" 
                onClick={() => libraryNotifications.onTrackLiked('Imagine - John Lennon')}
                sx={{ justifyContent: 'flex-start' }}
              >
                Canción añadida a favoritos
              </Button>
              <Button 
                variant="outlined" 
                onClick={() => libraryNotifications.onArtistFollowed('Queen')}
                sx={{ justifyContent: 'flex-start' }}
              >
                Artista seguido
              </Button>
              <Button 
                variant="outlined" 
                onClick={() => libraryNotifications.onArtistUnfollowed('Michael Jackson')}
                sx={{ justifyContent: 'flex-start' }}
              >
                Artista dejado de seguir
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* Notificaciones de error */}
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 2, bgcolor: 'background.paper', height: '100%' }}>
            <Typography variant="h6" gutterBottom>Notificaciones de error</Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Button 
                variant="outlined" 
                onClick={() => errorNotifications.onNetworkError()}
                sx={{ justifyContent: 'flex-start' }}
              >
                Error de conexión
              </Button>
              <Button 
                variant="outlined" 
                onClick={() => errorNotifications.onServerError()}
                sx={{ justifyContent: 'flex-start' }}
              >
                Error del servidor
              </Button>
              <Button 
                variant="outlined" 
                onClick={() => errorNotifications.onUnexpectedError('Algo salió mal')}
                sx={{ justifyContent: 'flex-start' }}
              >
                Error inesperado
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* Tipos de notificación */}
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 2, bgcolor: 'background.paper' }}>
            <Typography variant="h6" gutterBottom>Tipos de notificación</Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Button 
                variant="contained" 
                color="success"
                onClick={() => showNotification('Esta es una notificación de éxito', 'success')}
              >
                Éxito
              </Button>
              <Button 
                variant="contained" 
                color="error"
                onClick={() => showNotification('Esta es una notificación de error', 'error')}
              >
                Error
              </Button>
              <Button 
                variant="contained" 
                color="info"
                onClick={() => showNotification('Esta es una notificación informativa', 'info')}
              >
                Info
              </Button>
              <Button 
                variant="contained" 
                color="warning"
                onClick={() => showNotification('Esta es una notificación de advertencia', 'warning')}
              >
                Advertencia
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
} 