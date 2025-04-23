'use client';

import { useState, useEffect } from 'react';
import { Button, Container, Typography, Paper, Box, CircularProgress, Alert, AlertTitle, List, ListItem, ListItemIcon, ListItemText } from '@mui/material';
import { signIn, useSession } from 'next-auth/react';
import { SpotifyIcon } from '@/components/icons/MusicIcons';
import { useRouter } from 'next/navigation';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

export default function AdminPage() {
  const { data: session, status } = useSession();
  const [isInitializing, setIsInitializing] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; message?: string; error?: string } | null>(null);
  const [languages, setLanguages] = useState<string[]>(['es', 'en', 'fr', 'it']);
  const [showTips, setShowTips] = useState(false);
  const router = useRouter();

  // Verificar autenticación
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  const handleInitializeDemo = async () => {
    if (!session?.accessToken) {
      setResult({
        success: false,
        error: 'No hay sesión activa de Spotify. Por favor, inicia sesión primero.'
      });
      return;
    }

    setIsInitializing(true);
    setResult(null);

    try {
      const response = await fetch('/api/admin/initialize-demo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          languages
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al inicializar el modo demo');
      }

      setResult({
        success: true,
        message: data.message || 'Modo demo inicializado correctamente'
      });
    } catch (error) {
      console.error('Error al inicializar el modo demo:', error);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
      setShowTips(true);
    } finally {
      setIsInitializing(false);
    }
  };

  if (status === 'loading') {
    return (
      <Container maxWidth="md" sx={{ py: 8, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="body1" sx={{ mt: 2 }}>
          Verificando credenciales...
        </Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Administración del Modo Demo
        </Typography>

        <Typography variant="body1" paragraph>
          Desde aquí puedes inicializar o actualizar los datos utilizados en el modo demo.
          Este proceso recopilará automáticamente datos desde Spotify utilizando tu cuenta
          y los acumulará con los datos existentes, enriqueciendo la base de datos demo.
        </Typography>

        <Alert severity="info" sx={{ my: 2 }}>
          <AlertTitle>Acumulación de datos</AlertTitle>
          <Typography variant="body2">
            Los datos nuevos se acumularán con los existentes, sin duplicados. Con cada inicialización,
            tendrás más artistas, canciones y álbumes disponibles en el modo demo.
          </Typography>
        </Alert>

        {!session?.accessToken ? (
          <Box sx={{ my: 4, textAlign: 'center' }}>
            <Typography variant="body1" gutterBottom>
              Necesitas iniciar sesión con Spotify para continuar.
            </Typography>
            <Button
              variant="contained"
              startIcon={<SpotifyIcon />}
              onClick={() => signIn('spotify')}
              sx={{ bgcolor: '#1DB954', '&:hover': { bgcolor: '#1aa34a' }, mt: 2 }}
            >
              Iniciar sesión con Spotify
            </Button>
          </Box>
        ) : (
          <>
            <Alert severity="info" sx={{ my: 3 }}>
              <AlertTitle>Información importante</AlertTitle>
              <Typography variant="body2">
                Algunos datos podrían no estar disponibles debido a limitaciones de la API de Spotify.
                En esos casos, se generarán datos de demostración automáticamente.
              </Typography>
            </Alert>

            <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
              Idiomas a incluir
            </Typography>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 4 }}>
              {[
                { code: 'es', name: 'Español' },
                { code: 'en', name: 'English' },
                { code: 'fr', name: 'Français' },
                { code: 'it', name: 'Italiano' }
              ].map(lang => (
                <Button
                  key={lang.code}
                  variant={languages.includes(lang.code) ? "contained" : "outlined"}
                  size="small"
                  onClick={() => {
                    if (languages.includes(lang.code)) {
                      setLanguages(languages.filter(l => l !== lang.code));
                    } else {
                      setLanguages([...languages, lang.code]);
                    }
                  }}
                  sx={{ minWidth: '100px' }}
                >
                  {lang.name}
                </Button>
              ))}
            </Box>

            <Button
              variant="contained"
              color="primary"
              disabled={isInitializing || languages.length === 0}
              onClick={handleInitializeDemo}
              startIcon={isInitializing ? <CircularProgress size={20} color="inherit" /> : null}
              fullWidth
              sx={{ py: 1.5, fontSize: '1.1rem' }}
            >
              {isInitializing ? 'Inicializando...' : 'Acumular Datos Demo'}
            </Button>

            {result && (
              <Alert
                severity={result.success ? 'success' : 'error'}
                sx={{ mt: 3 }}
              >
                <AlertTitle>{result.success ? 'Éxito' : 'Error'}</AlertTitle>
                {result.message || result.error}
              </Alert>
            )}

            {showTips && (
              <Box sx={{ mt: 3, bgcolor: 'background.paper', p: 2, borderRadius: 1 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Posibles soluciones a problemas comunes:
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemIcon>
                      <InfoIcon color="info" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Error 404 (Not Found)"
                      secondary="Se generarán datos mock automáticamente para endpoints no disponibles"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <WarningIcon color="warning" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Error 401 (Unauthorized)"
                      secondary="Inicia sesión nuevamente con tu cuenta de Spotify"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <WarningIcon color="warning" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Error 403 (Forbidden)"
                      secondary="Tu cuenta puede no tener los permisos necesarios"
                    />
                  </ListItem>
                </List>
              </Box>
            )}

            <Typography variant="body2" sx={{ mt: 4, color: 'text.secondary' }}>
              Este proceso puede tomar varios minutos dependiendo de la cantidad de datos a recopilar.
              Los datos recopilados se guardarán en el servidor y estarán disponibles para el modo demo.
            </Typography>
          </>
        )}
      </Paper>
    </Container>
  );
}
