'use client';

import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  CircularProgress, 
  Paper, 
  Chip, 
  Grid, 
  FormControl, 
  Select, 
  MenuItem, 
  InputLabel, 
  Card, 
  CardMedia, 
  CardContent,
  Divider,
  Button,
  Alert,
  TextField,
  Snackbar
} from '@mui/material';
import { motion } from 'framer-motion';
import { getUserGenres } from '@/services/spotify';

// Lista de géneros populares para mostrar cuando se requiere selección manual
const popularGenresForSelection = [
  { name: 'Pop', color: '#f037a5' },
  { name: 'Rock', color: '#ff5e3a' },
  { name: 'Hip Hop', color: '#4087f5' },
  { name: 'Rap', color: '#3e44b1' },
  { name: 'R&B', color: '#b373f2' },
  { name: 'Electrónica', color: '#19bdf2' },
  { name: 'EDM', color: '#00c9ff' },
  { name: 'Dance', color: '#0066ff' },
  { name: 'House', color: '#0099ff' },
  { name: 'Techno', color: '#00ccff' },
  { name: 'Indie', color: '#727277' },
  { name: 'Alternative', color: '#555555' },
  { name: 'Punk', color: '#e10600' },
  { name: 'Metal', color: '#444444' },
  { name: 'Rock alternativo', color: '#663399' },
  { name: 'Clásica', color: '#18cd75' },
  { name: 'Jazz', color: '#ff9950' },
  { name: 'Blues', color: '#0072bb' },
  { name: 'Country', color: '#996633' },
  { name: 'Folk', color: '#cc9966' },
  { name: 'Reggae', color: '#00cc66' },
  { name: 'Reggaetón', color: '#e9446a' },
  { name: 'Latin', color: '#ff7700' },
  { name: 'Salsa', color: '#ff8c00' },
  { name: 'Bachata', color: '#ffcc00' },
  { name: 'K-pop', color: '#ff00ff' },
  { name: 'J-pop', color: '#ff66cc' },
  { name: 'Anime', color: '#ff3399' },
  { name: 'Soul', color: '#7d4e57' },
  { name: 'Funk', color: '#bf5b17' },
  { name: 'Disco', color: '#9933cc' },
  { name: 'Gospel', color: '#663300' },
  { name: 'Lo-fi', color: '#666699' },
  { name: 'Ambient', color: '#99ccff' },
  { name: 'Trap', color: '#770000' },
  { name: 'Soundtrack', color: '#336699' }
];

// Componente que muestra un gráfico de barras simple para representar porcentajes
function PercentageBar({ percentage, color = '#1DB954' }: { percentage: number, color?: string }) {
  return (
    <Box sx={{ width: '100%', bgcolor: 'rgba(255,255,255,0.1)', height: 8, borderRadius: 4, overflow: 'hidden' }}>
      <Box 
        sx={{ 
          width: `${percentage}%`, 
          bgcolor: color, 
          height: '100%',
          transition: 'width 1s ease-in-out'
        }} 
      />
    </Box>
  );
}

// Componente para la selección manual de géneros
function ManualGenreSelector({ onSelectionComplete }: { onSelectionComplete: (genres: any[]) => void }) {
  const [selectedGenres, setSelectedGenres] = useState<Array<{name: string, color: string}>>([]);
  const [customGenre, setCustomGenre] = useState('');
  const [error, setError] = useState('');
  const [showSnackbar, setShowSnackbar] = useState(false);

  const handleGenreClick = (genre: {name: string, color: string}) => {
    // Verificar si ya está seleccionado
    if (selectedGenres.some(g => g.name === genre.name)) {
      // Remover el género
      setSelectedGenres(selectedGenres.filter(g => g.name !== genre.name));
    } else {
      // Añadir el género si no hemos alcanzado el límite
      if (selectedGenres.length < 10) {
        setSelectedGenres([...selectedGenres, genre]);
      } else {
        setError('Puedes seleccionar un máximo de 10 géneros');
        setShowSnackbar(true);
      }
    }
  };

  const handleCustomGenreAdd = () => {
    if (!customGenre.trim()) return;
    
    // Verificar si ya existe
    if (selectedGenres.some(g => g.name.toLowerCase() === customGenre.toLowerCase())) {
      setError('Este género ya ha sido seleccionado');
      setShowSnackbar(true);
      return;
    }
    
    // Verificar límite
    if (selectedGenres.length >= 10) {
      setError('Puedes seleccionar un máximo de 10 géneros');
      setShowSnackbar(true);
      return;
    }
    
    // Generar un color aleatorio para el género personalizado
    const randomColorIndex = Math.floor(Math.random() * popularGenresForSelection.length);
    const newGenre = {
      name: customGenre.trim(),
      color: popularGenresForSelection[randomColorIndex].color
    };
    
    setSelectedGenres([...selectedGenres, newGenre]);
    setCustomGenre('');
  };

  const handleSubmit = () => {
    if (selectedGenres.length < 3) {
      setError('Por favor, selecciona al menos 3 géneros');
      setShowSnackbar(true);
      return;
    }
    
    // Convertir los géneros seleccionados al formato esperado
    const formattedGenres = selectedGenres.map(genre => ({
      name: genre.name,
      count: Math.floor(Math.random() * 30) + 70, // Valor aleatorio entre 70-100
      percentage: Math.floor(Math.random() * 30) + 70 // Porcentaje aleatorio entre 70-100%
    }));
    
    onSelectionComplete(formattedGenres);
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Selecciona tus géneros musicales favoritos
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Por favor, selecciona entre 3 y 10 géneros musicales que te gusten. Esto nos ayudará a personalizar tus recomendaciones.
      </Typography>
      
      <Box sx={{ mb: 3 }}>
        <Typography variant="body2" fontWeight="medium" gutterBottom>
          Géneros seleccionados: {selectedGenres.length}/10
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {selectedGenres.length > 0 ? (
            selectedGenres.map((genre) => (
              <Chip
                key={genre.name}
                label={genre.name}
                onDelete={() => handleGenreClick(genre)}
                sx={{
                  bgcolor: genre.color,
                  color: 'white',
                  fontWeight: 'medium'
                }}
              />
            ))
          ) : (
            <Typography variant="body2" color="text.secondary">
              No has seleccionado ningún género todavía.
            </Typography>
          )}
        </Box>
      </Box>
      
      <Box sx={{ mb: 3 }}>
        <Typography variant="body2" fontWeight="medium" gutterBottom>
          Añadir género personalizado:
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            size="small"
            placeholder="Escribe un género musical"
            value={customGenre}
            onChange={(e) => setCustomGenre(e.target.value)}
            fullWidth
            onKeyPress={(e) => e.key === 'Enter' && handleCustomGenreAdd()}
          />
          <Button 
            variant="contained" 
            onClick={handleCustomGenreAdd}
          >
            Añadir
          </Button>
        </Box>
      </Box>
      
      <Box sx={{ mb: 3 }}>
        <Typography variant="body2" fontWeight="medium" gutterBottom>
          Géneros populares:
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {popularGenresForSelection.map((genre) => {
            const isSelected = selectedGenres.some(g => g.name === genre.name);
            return (
              <Chip
                key={genre.name}
                label={genre.name}
                onClick={() => handleGenreClick(genre)}
                sx={{
                  bgcolor: isSelected ? genre.color : 'rgba(255,255,255,0.1)',
                  color: isSelected ? 'white' : 'text.primary',
                  fontWeight: isSelected ? 'medium' : 'normal',
                  '&:hover': {
                    bgcolor: isSelected ? genre.color : 'rgba(255,255,255,0.2)'
                  }
                }}
              />
            );
          })}
        </Box>
      </Box>
      
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4 }}>
        <Button 
          variant="contained" 
          color="primary" 
          size="large"
          onClick={handleSubmit}
          disabled={selectedGenres.length < 3}
          sx={{ minWidth: 140 }}
        >
          Confirmar
        </Button>
      </Box>
      
      <Snackbar
        open={showSnackbar}
        autoHideDuration={4000}
        onClose={() => setShowSnackbar(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setShowSnackbar(false)} 
          severity="warning" 
          variant="filled"
        >
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
}

// Componente principal para la página de géneros
export default function UserGenresPage() {
  const [genresData, setGenresData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<string>('medium_term');
  const [needManualSelection, setNeedManualSelection] = useState(false);

  // Cargar datos de géneros
  useEffect(() => {
    const fetchGenres = async () => {
      setLoading(true);
      try {
        const data = await getUserGenres(timeRange);
        setGenresData(data);
        
        // Verificar si necesitamos selección manual
        if (data.hasUserInput) {
          setNeedManualSelection(true);
        } else {
          setNeedManualSelection(false);
        }
      } catch (err) {
        console.error('Error al obtener géneros:', err);
        setError('No se pudieron cargar tus géneros musicales.');
      } finally {
        setLoading(false);
      }
    };

    fetchGenres();
  }, [timeRange]);

  // Manejar cambio de rango de tiempo
  const handleTimeRangeChange = (event: any) => {
    setTimeRange(event.target.value);
  };
  
  // Manejar selección manual de géneros
  const handleManualGenreSelection = (selectedGenres: any[]) => {
    // Construir un objeto con el formato esperado para mostrar
    const manualGenresData = {
      success: true,
      message: "Géneros seleccionados manualmente",
      topGenres: selectedGenres,
      allGenres: selectedGenres.reduce((acc: any, genre: any) => {
        acc[genre.name] = genre.count;
        return acc;
      }, {}),
      topArtists: [],
      source: "selección manual",
      hasUserInput: false
    };
    
    setGenresData(manualGenresData);
    setNeedManualSelection(false);
  };

  // Mostrar pantalla de carga
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress color="secondary" />
      </Box>
    );
  }

  // Mostrar mensaje de error
  if (error) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="h5" color="error" gutterBottom>
          Error al cargar tus géneros musicales
        </Typography>
        <Typography color="text.secondary">
          {error}
        </Typography>
        <Button 
          variant="contained" 
          color="primary" 
          sx={{ mt: 3 }}
          onClick={() => window.location.reload()}
        >
          Reintentar
        </Button>
      </Box>
    );
  }
  
  // Mostrar selector manual de géneros
  if (needManualSelection) {
    return (
      <div className="min-h-screen py-8">
        <div className="max-w-4xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
              Cuéntanos sobre tus gustos musicales
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 4 }}>
              No pudimos determinar automáticamente tus géneros favoritos. Ayúdanos a conocer tus gustos.
            </Typography>
          </motion.div>
          
          <Paper elevation={0} sx={{ p: 3, borderRadius: 2, bgcolor: 'background.paper' }}>
            <ManualGenreSelector onSelectionComplete={handleManualGenreSelection} />
          </Paper>
        </div>
      </div>
    );
  }

  // Asignar colores a los géneros principales
  const genreColors = [
    '#1DB954', // Verde Spotify
    '#FF6B6B', // Rojo coral
    '#4A90E2', // Azul
    '#9B59B6', // Púrpura
    '#F39C12', // Naranja
    '#E74C3C', // Rojo
    '#16A085', // Verde azulado
    '#2ECC71', // Verde esmeralda
    '#F1C40F', // Amarillo
    '#8E44AD', // Púrpura oscuro
    '#3498DB', // Azul cielo
    '#E67E22', // Naranja oscuro
    '#27AE60', // Verde bosque
    '#D35400', // Naranja quemado
    '#2980B9', // Azul acero
    '#C0392B', // Rojo cereza
    '#1ABC9C', // Turquesa
    '#F39C12', // Ámbar
    '#7F8C8D', // Gris
    '#34495E', // Azul pizarra
  ];

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
            Tus Géneros Musicales
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 4 }}>
            {genresData.source ? `Basado en tus ${genresData.source}` : 'Descubre los géneros que más escuchas'}
          </Typography>
        </motion.div>

        {/* Selector de rango de tiempo - Solo mostrarlo si no son datos manuales */}
        {genresData.source !== "selección manual" && (
          <Box sx={{ mb: 4 }}>
            <FormControl variant="outlined" size="small" sx={{ minWidth: 200 }}>
              <InputLabel id="time-range-label">Periodo de tiempo</InputLabel>
              <Select
                labelId="time-range-label"
                id="time-range-select"
                value={timeRange}
                onChange={handleTimeRangeChange}
                label="Periodo de tiempo"
              >
                <MenuItem value="short_term">Últimas 4 semanas</MenuItem>
                <MenuItem value="medium_term">Últimos 6 meses</MenuItem>
                <MenuItem value="long_term">Todos los tiempos</MenuItem>
              </Select>
            </FormControl>
          </Box>
        )}

        {/* Visualización de géneros */}
        <Grid container spacing={3}>
          {/* Gráfico de barras de géneros */}
          <Grid item xs={12}>
            <Paper elevation={0} sx={{ p: 3, borderRadius: 2, bgcolor: 'background.paper', mb: 3 }}>
              <Typography variant="h6" gutterBottom fontWeight="medium">
                Distribución de géneros
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Box sx={{ mb: 4 }}>
                {genresData.topGenres.slice(0, 10).map((genre: any, index: number) => (
                  <Box key={genre.name} sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" fontWeight="medium">
                        {genre.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {genre.percentage}%
                      </Typography>
                    </Box>
                    <PercentageBar 
                      percentage={genre.percentage} 
                      color={genreColors[index % genreColors.length]} 
                    />
                  </Box>
                ))}
              </Box>
            </Paper>
          </Grid>

          {/* Chips de géneros */}
          <Grid item xs={12} md={6}>
            <Paper elevation={0} sx={{ p: 3, borderRadius: 2, bgcolor: 'background.paper', height: '100%' }}>
              <Typography variant="h6" gutterBottom fontWeight="medium">
                Todos tus géneros
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {genresData.topGenres.map((genre: any, index: number) => (
                  <Chip
                    key={genre.name}
                    label={`${genre.name} (${genre.count})`}
                    sx={{
                      bgcolor: genreColors[index % genreColors.length],
                      color: 'white',
                      fontWeight: 'medium',
                      mb: 1
                    }}
                  />
                ))}
              </Box>
            </Paper>
          </Grid>

          {/* Artistas principales - Solo si hay artistas */}
          <Grid item xs={12} md={6}>
            <Paper elevation={0} sx={{ p: 3, borderRadius: 2, bgcolor: 'background.paper', height: '100%' }}>
              <Typography variant="h6" gutterBottom fontWeight="medium">
                {genresData.topArtists && genresData.topArtists.length > 0 
                  ? 'Artistas que definen tus géneros' 
                  : 'Tu perfil musical'}
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              {genresData.topArtists && genresData.topArtists.length > 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {genresData.topArtists.slice(0, 5).map((artist: any) => (
                    <Box key={artist.id} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      {artist.images && artist.images.length > 0 ? (
                        <img 
                          src={artist.images[0].url} 
                          alt={artist.name}
                          style={{ width: 50, height: 50, borderRadius: '50%', objectFit: 'cover' }}
                        />
                      ) : (
                        <Box 
                          sx={{ 
                            width: 50, 
                            height: 50, 
                            borderRadius: '50%', 
                            bgcolor: 'rgba(255,255,255,0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <Typography variant="body2" color="text.secondary">N/A</Typography>
                        </Box>
                      )}
                      <Box>
                        <Typography variant="body1" fontWeight="medium">
                          {artist.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {artist.genres?.slice(0, 3).join(', ')}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              ) : (
                <Box sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="body1" color="text.secondary">
                    Tus géneros favoritos indican que podrías disfrutar de artistas como {' '}
                    {genresData.topGenres.slice(0, 3).map((g: any) => g.name).join(', ')} y más.
                  </Typography>
                  
                  <Button 
                    variant="outlined" 
                    color="primary" 
                    sx={{ mt: 2 }}
                    onClick={() => window.open('/explore', '_self')}
                  >
                    Explorar artistas similares
                  </Button>
                </Box>  
              )}
            </Paper>
          </Grid>
        </Grid>

        {/* Información contextual */}
        <Paper 
          elevation={0} 
          sx={{ 
            p: 3, 
            borderRadius: 2, 
            bgcolor: 'background.paper', 
            mt: 3,
            border: '1px solid',
            borderColor: 'divider'
          }}
        >
          <Typography variant="body2" color="text.secondary">
            <strong>Nota:</strong> {' '}
            {genresData.source === "selección manual" 
              ? "Esta información está basada en los géneros que seleccionaste manualmente. Puedes actualizarlos en cualquier momento."
              : "Esta información se basa en los artistas que escuchas con frecuencia. Los géneros son asignados por Spotify a los artistas. Algunos artistas pueden tener múltiples géneros asignados. Cambia el periodo de tiempo para ver cómo evolucionan tus gustos musicales."}
          </Typography>
        </Paper>
      </div>
    </div>
  );
} 