'use client';

import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Container, 
  Grid, 
  Card, 
  CardContent, 
  CardMedia,
  Button,
  Divider,
  CircularProgress,
  IconButton,
  Alert,
  Chip
} from '@mui/material';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePlayer } from '@/contexts/PlayerContext';
import { useAuth } from '@/components/providers/AuthProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { youtubeMusicAPI } from '@/services/youtube';
import UnifiedMusicCard from '@/components/UnifiedMusicCard';
import Image from 'next/image';
import { PlayArrow, Search, Refresh } from '@mui/icons-material';
import { Track } from '@/types/types';
import ServerStatus from '@/components/ServerStatus';

const MotionGrid = motion(Grid);
const MotionCard = motion(Card);

export default function MoodsPage() {
  const [moodCategories, setMoodCategories] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCategoryTitle, setSelectedCategoryTitle] = useState<string>('');
  const [moodPlaylists, setMoodPlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const router = useRouter();
  const { playTrack } = usePlayer();
  const { isAuthenticated, isDemo } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    const fetchMoodCategories = async () => {
      try {
        setLoading(true);
        const categories = await youtubeMusicAPI.getMoodCategories();
        setMoodCategories(categories);
        setError(null);
      } catch (err) {
        console.error('Error al obtener categorías de mood:', err);
        setError('No se pudieron cargar las categorías de estado de ánimo');
      } finally {
        setLoading(false);
      }
    };

    fetchMoodCategories();
  }, []);

  const fetchMoodPlaylists = async (params: string, title: string) => {
    if (params === selectedCategory) return; // Evitar cargar de nuevo los mismos datos
    
    try {
      setLoadingPlaylists(true);
      setSelectedCategory(params);
      setSelectedCategoryTitle(title);
      
      const playlists = await youtubeMusicAPI.getMoodPlaylists(params);
      setMoodPlaylists(playlists?.playlists || []);
      setError(null);
    } catch (err) {
      console.error('Error al obtener playlists de mood:', err);
      setError('No se pudieron cargar las listas de reproducción');
      setMoodPlaylists([]);
    } finally {
      setLoadingPlaylists(false);
    }
  };

  const handlePlaylistClick = (playlistId: string) => {
    router.push(`/playlist/${playlistId}?source=youtube`);
  };

  // Animación para las categorías
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 100,
        damping: 15
      }
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
        {t('explore.moodsTitle')}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
          <ServerStatus showDetailed={true} />
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
          <CircularProgress />
        </Box>
      ) : (
        <>
          {moodCategories && (
            <Box mb={5}>
              <Typography variant="h5" gutterBottom>
                {t('explore.selectMoodCategory')}
              </Typography>
              
              <motion.div 
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                <Grid container spacing={2}>
                  {Object.entries(moodCategories).map(([category, items]: [string, any]) => (
                    <Grid item xs={12} key={category}>
                      <Typography variant="h6" sx={{ mb: 2, mt: 2 }}>
                        {category}
                      </Typography>
                      <Grid container spacing={2}>
                        {items.map((item: any) => (
                          <MotionGrid 
                            item 
                            xs={6} 
                            sm={4} 
                            md={3} 
                            lg={2} 
                            key={item.params}
                            variants={itemVariants}
                          >
                            <MotionCard 
                              sx={{ 
                                borderRadius: 2,
                                cursor: 'pointer',
                                background: 'linear-gradient(135deg, #1e1e1e 0%, #2d2d2d 100%)',
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                  transform: 'translateY(-5px)',
                                  boxShadow: '0 10px 20px rgba(0,0,0,0.2)'
                                }
                              }}
                              onClick={() => fetchMoodPlaylists(item.params, item.title)}
                            >
                              <CardContent>
                                <Typography variant="h6" align="center" sx={{ color: 'primary.main' }}>
                                  {item.title}
                                </Typography>
                              </CardContent>
                            </MotionCard>
                          </MotionGrid>
                        ))}
                      </Grid>
                    </Grid>
                  ))}
                </Grid>
              </motion.div>
            </Box>
          )}

          {loadingPlaylists ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
              <CircularProgress />
            </Box>
          ) : selectedCategory && (
            <Box>
              <Typography variant="h5" gutterBottom>
                {t('explore.playlistsFor')} {selectedCategoryTitle}
              </Typography>
              
              {moodPlaylists.length > 0 ? (
                <Grid container spacing={2}>
                  {moodPlaylists.map((playlist) => (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={playlist.playlistId}>
                      <Card 
                        sx={{ 
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          borderRadius: 2,
                          overflow: 'hidden',
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            transform: 'translateY(-5px)',
                            boxShadow: '0 8px 16px rgba(0,0,0,0.2)'
                          }
                        }}
                        onClick={() => handlePlaylistClick(playlist.browseId)}
                      >
                        <CardMedia
                          component="div"
                          sx={{ 
                            pt: '56.25%', 
                            position: 'relative',
                            '&:hover .playButton': {
                              opacity: 1
                            }
                          }}
                        >
                          <Image
                            src={playlist.thumbnails?.[0]?.url || '/placeholder-playlist.jpg'}
                            alt={playlist.title}
                            fill
                            style={{
                              objectFit: 'cover',
                            }}
                          />
                          <Box 
                            className="playButton"
                            sx={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: 'rgba(0,0,0,0.5)',
                              opacity: 0,
                              transition: 'opacity 0.3s ease'
                            }}
                          >
                            <IconButton 
                              sx={{ 
                                backgroundColor: 'primary.main',
                                color: 'white',
                                '&:hover': {
                                  backgroundColor: 'primary.dark'
                                }
                              }}
                            >
                              <PlayArrow />
                            </IconButton>
                          </Box>
                        </CardMedia>
                        <CardContent sx={{ flexGrow: 1 }}>
                          <Typography variant="h6" gutterBottom sx={{ fontSize: '1rem' }}>
                            {playlist.title}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {playlist.description || t('common.playlist')}
                          </Typography>
                          {playlist.count && (
                            <Chip 
                              label={`${playlist.count} ${t('common.songs')}`} 
                              size="small" 
                              sx={{ mt: 1 }}
                            />
                          )}
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Typography variant="body1">
                    {t('explore.noPlaylists')}
                  </Typography>
                  <ServerStatus showDetailed={true} />
                </Box>
              )}
            </Box>
          )}
        </>
      )}
    </Container>
  );
} 