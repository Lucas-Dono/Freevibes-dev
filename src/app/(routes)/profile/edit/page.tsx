'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Card, 
  CardContent, 
  Typography, 
  Button, 
  TextField, 
  Box, 
  Avatar, 
  CircularProgress,
  Chip,
  FormControl,
  InputLabel,
  FormHelperText,
  Divider,
  Grid,
  Paper
} from '@mui/material';
import useProfile from '@/hooks/useProfile';
import { motion } from 'framer-motion';
import { useCustomNotifications } from '@/hooks/useCustomNotifications';

// Géneros populares para sugerir al usuario
const popularGenres = [
  { name: 'Rock', color: '#ff5e3a' },
  { name: 'Pop', color: '#f037a5' },
  { name: 'Hip Hop', color: '#4087f5' },
  { name: 'Electrónica', color: '#19bdf2' },
  { name: 'Jazz', color: '#ff9950' },
  { name: 'Clásica', color: '#18cd75' },
  { name: 'R&B', color: '#b373f2' },
  { name: 'Indie', color: '#727277' },
  { name: 'Reggaetón', color: '#e9446a' },
  { name: 'Metal', color: '#444444' },
  { name: 'Salsa', color: '#ff8c00' },
  { name: 'Blues', color: '#0072bb' },
];

export default function EditProfilePage() {
  const router = useRouter();
  const { profile, loading, error, updateProfile } = useProfile();
  const { showNotification, addSystemNotification } = useCustomNotifications();
  
  // Estados para el formulario
  const [formData, setFormData] = useState({
    username: '',
    bio: '',
    profileImage: '',
    coverImage: '',
    favoriteGenres: [] as Array<{name: string; color?: string}>,
  });
  
  const [formErrors, setFormErrors] = useState({
    username: '',
    bio: '',
    profileImage: '',
    coverImage: '',
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Configurar el formulario cuando el perfil esté disponible
  useEffect(() => {
    if (profile) {
      setFormData({
        username: profile.username || '',
        bio: profile.bio || '',
        profileImage: profile.profileImage || '',
        coverImage: profile.coverImage || '',
        favoriteGenres: profile.favoriteGenres || [],
      });
    }
  }, [profile]);
  
  // Manejar cambios en los campos del formulario
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
    
    // Limpiar errores cuando el usuario modifica un campo
    setFormErrors({
      ...formErrors,
      [name]: '',
    });
  };
  
  // Manejar la adición de géneros musicales favoritos
  const handleAddGenre = (genre: { name: string; color?: string }) => {
    // Verificar si el género ya existe
    if (!formData.favoriteGenres.some(g => g.name === genre.name)) {
      setFormData({
        ...formData,
        favoriteGenres: [...formData.favoriteGenres, genre],
      });
    }
  };
  
  // Manejar la eliminación de géneros
  const handleRemoveGenre = (genreName: string) => {
    setFormData({
      ...formData,
      favoriteGenres: formData.favoriteGenres.filter(g => g.name !== genreName),
    });
  };
  
  // Validación del formulario
  const validateForm = () => {
    let isValid = true;
    const errors = {
      username: '',
      bio: '',
      profileImage: '',
      coverImage: '',
    };
    
    // Validación de nombre de usuario (solo caracteres alfanuméricos y guiones bajos)
    if (formData.username && !/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      errors.username = 'El nombre de usuario solo puede contener letras, números y guiones bajos.';
      isValid = false;
    }
    
    // Validación de longitud de bio
    if (formData.bio && formData.bio.length > 500) {
      errors.bio = 'La bio no puede superar los 500 caracteres.';
      isValid = false;
    }
    
    // Validación de URL de imagen de perfil
    if (formData.profileImage && !isValidURL(formData.profileImage)) {
      errors.profileImage = 'Ingresa una URL válida para la imagen de perfil.';
      isValid = false;
    }
    
    // Validación de URL de imagen de portada
    if (formData.coverImage && !isValidURL(formData.coverImage)) {
      errors.coverImage = 'Ingresa una URL válida para la imagen de portada.';
      isValid = false;
    }
    
    setFormErrors(errors);
    return isValid;
  };
  
  // Función helper para validar URLs
  const isValidURL = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };
  
  // Manejar el envío del formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar el formulario
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors as any);
      showNotification('Por favor corrige los errores en el formulario', 'error');
      return;
    }
    
    setIsSubmitting(true);
    setFormErrors({} as any);
    setShowSuccess(false);
    
    try {
      const updatedProfile = await updateProfile(formData);
      
      if (updatedProfile) {
        setShowSuccess(true);
        showNotification('Perfil actualizado con éxito', 'success');
        
        // Redireccionar después de un breve periodo (para que el usuario vea el mensaje de éxito)
        setTimeout(() => {
          router.push(`/user/${updatedProfile.id}`);
        }, 2000);
      }
    } catch (error) {
      setSubmitError('Error al actualizar el perfil. Por favor, intenta de nuevo más tarde.');
      showNotification('Error al actualizar el perfil', 'error');
      console.error('Error actualizando perfil:', error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (loading) {
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
  
  if (error) {
    return (
      <Box sx={{ 
        py: 4, 
        textAlign: 'center' 
      }}>
        <Typography variant="h5" color="error" gutterBottom>
          Error al cargar el perfil
        </Typography>
        <Typography color="text.secondary">
          {error}
        </Typography>
        <Button 
          variant="contained" 
          color="primary" 
          sx={{ mt: 3 }}
          onClick={() => router.push('/home')}
        >
          Volver al inicio
        </Button>
      </Box>
    );
  }
  
  return (
    <div className="min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
            Editar Perfil
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 4 }}>
            Personaliza tu perfil con tus datos e intereses musicales
          </Typography>
        </motion.div>
        
        <Paper elevation={0} sx={{ p: 3, borderRadius: 2, bgcolor: 'background.paper' }}>
          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              {/* Sección de imágenes */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom fontWeight="medium">
                  Imágenes de perfil
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth sx={{ mb: 3 }}>
                      <InputLabel htmlFor="profileImage" shrink>
                        URL de imagen de perfil
                      </InputLabel>
                      <TextField
                        id="profileImage"
                        name="profileImage"
                        value={formData.profileImage}
                        onChange={handleChange}
                        placeholder="https://ejemplo.com/tu-imagen.jpg"
                        error={!!formErrors.profileImage}
                        helperText={formErrors.profileImage}
                        fullWidth
                        sx={{ mt: 1 }}
                      />
                      {formData.profileImage && (
                        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                          <Avatar
                            src={formData.profileImage}
                            alt="Vista previa de perfil"
                            sx={{ width: 100, height: 100 }}
                          />
                        </Box>
                      )}
                    </FormControl>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth sx={{ mb: 3 }}>
                      <InputLabel htmlFor="coverImage" shrink>
                        URL de imagen de portada
                      </InputLabel>
                      <TextField
                        id="coverImage"
                        name="coverImage"
                        value={formData.coverImage}
                        onChange={handleChange}
                        placeholder="https://ejemplo.com/tu-portada.jpg"
                        error={!!formErrors.coverImage}
                        helperText={formErrors.coverImage}
                        fullWidth
                        sx={{ mt: 1 }}
                      />
                      {formData.coverImage && (
                        <Box sx={{ mt: 2 }}>
                          <img
                            src={formData.coverImage}
                            alt="Vista previa de portada"
                            style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 8 }}
                          />
                        </Box>
                      )}
                    </FormControl>
                  </Grid>
                </Grid>
              </Grid>
              
              {/* Información personal */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom fontWeight="medium">
                  Información personal
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth sx={{ mb: 3 }}>
                      <InputLabel htmlFor="username" shrink>
                        Nombre de usuario
                      </InputLabel>
                      <TextField
                        id="username"
                        name="username"
                        value={formData.username}
                        onChange={handleChange}
                        placeholder="tu_nombre_usuario"
                        error={!!formErrors.username}
                        helperText={formErrors.username || "Este nombre aparecerá en tu perfil público"}
                        fullWidth
                        sx={{ mt: 1 }}
                      />
                    </FormControl>
                  </Grid>
                  
                  <Grid item xs={12}>
                    <FormControl fullWidth sx={{ mb: 3 }}>
                      <InputLabel htmlFor="bio" shrink>
                        Biografía
                      </InputLabel>
                      <TextField
                        id="bio"
                        name="bio"
                        value={formData.bio}
                        onChange={handleChange}
                        placeholder="Cuéntanos sobre ti y tus gustos musicales..."
                        error={!!formErrors.bio}
                        helperText={formErrors.bio || `${formData.bio.length}/500 caracteres`}
                        fullWidth
                        multiline
                        rows={4}
                        sx={{ mt: 1 }}
                      />
                    </FormControl>
                  </Grid>
                </Grid>
              </Grid>
              
              {/* Géneros musicales */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom fontWeight="medium">
                  Géneros musicales favoritos
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Géneros seleccionados:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {formData.favoriteGenres.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        No has seleccionado ningún género musical.
                      </Typography>
                    ) : (
                      formData.favoriteGenres.map((genre) => (
                        <Chip
                          key={genre.name}
                          label={genre.name}
                          onDelete={() => handleRemoveGenre(genre.name)}
                          sx={{
                            bgcolor: genre.color || '#666',
                            color: 'white',
                            fontWeight: 'medium',
                          }}
                        />
                      ))
                    )}
                  </Box>
                </Box>
                
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Géneros populares:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {popularGenres.map((genre) => (
                      <Chip
                        key={genre.name}
                        label={genre.name}
                        onClick={() => handleAddGenre(genre)}
                        sx={{
                          bgcolor: 'rgba(255, 255, 255, 0.05)',
                          '&:hover': {
                            bgcolor: genre.color || '#666',
                            color: 'white',
                          },
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              </Grid>
              
              {/* Botones de acción */}
              <Grid item xs={12} sx={{ mt: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Button
                    variant="outlined"
                    color="inherit"
                    onClick={() => router.back()}
                    sx={{ borderRadius: 28 }}
                  >
                    Cancelar
                  </Button>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {showSuccess && (
                      <Typography variant="body2" color="success.main">
                        ¡Perfil actualizado correctamente!
                      </Typography>
                    )}
                    
                    {submitError && (
                      <Typography variant="body2" color="error">
                        {submitError}
                      </Typography>
                    )}
                    
                    <Button
                      variant="contained"
                      color="primary"
                      type="submit"
                      disabled={isSubmitting}
                      sx={{ borderRadius: 28 }}
                    >
                      {isSubmitting ? (
                        <CircularProgress size={24} color="inherit" />
                      ) : 'Guardar cambios'}
                    </Button>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </form>
        </Paper>
      </div>
    </div>
  );
} 