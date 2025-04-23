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
  Chip,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePlayer } from '@/contexts/PlayerContext';
import { useAuth } from '@/components/providers/AuthProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { getCharts } from '@/services/youtube/youtube-genres';
import { youtubeMusicAPI } from '@/services/youtube';
import UnifiedMusicCard from '@/components/UnifiedMusicCard';
import Image from 'next/image';
import { PlayArrow, Search, Refresh, Flag } from '@mui/icons-material';
import { Track } from '@/types/types';
import { playTrack as universalPlayTrack } from '@/services/player/playService';
import CountrySelector from '@/components/CountrySelector';
import ServerStatus from '@/components/ServerStatus';

interface ChartItem {
  title: string;
  videoId: string;
  playlistId?: string;
  artists: Array<{name: string, id?: string}>;
  thumbnails: Array<{url: string}>;
  views?: string;
}

export default function ChartsPage() {
  const [charts, setCharts] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [country, setCountry] = useState('ES'); // Default a España
  const [currentTab, setCurrentTab] = useState(0);

  const router = useRouter();
  const { playTrack } = usePlayer();
  const { isAuthenticated, isDemo } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    fetchCharts(country);
  }, [country]);

  const fetchCharts = async (countryCode: string) => {
    try {
      setLoading(true);
      const chartsData = await getCharts(countryCode);
      setCharts(chartsData);
      setError(null);
    } catch (err) {
      console.error('Error al obtener charts:', err);
      setError('No se pudieron cargar las listas de éxitos');
    } finally {
      setLoading(false);
    }
  };

  const handleCountryChange = (countryCode: string) => {
    setCountry(countryCode);
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const handlePlayTrack = (item: ChartItem) => {
    const track: Track = {
      id: item.videoId,
      title: item.title,
      artist: item.artists.map(a => a.name).join(', '),
      album: '',
      cover: item.thumbnails?.[0]?.url || '/placeholder-album.jpg',
      duration: 0,
      source: 'youtube',
      youtubeId: item.videoId
    };

    universalPlayTrack(track);
  };

  // Animación para los elementos
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
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
          {t('explore.chartsTitle')}
        </Typography>

        <Box display="flex" alignItems="center">
          <Flag sx={{ mr: 1, color: 'text.secondary' }} />
          <CountrySelector
            value={country}
            onChange={handleCountryChange}
            variant="standard"
          />
        </Box>
      </Box>

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
          {charts && (
            <Box>
              <Tabs
                value={currentTab}
                onChange={handleTabChange}
                sx={{
                  mb: 4,
                  '& .MuiTabs-indicator': {
                    backgroundColor: 'primary.main',
                  },
                  '& .MuiTab-root': {
                    textTransform: 'none',
                    fontWeight: 'medium',
                    fontSize: '1rem',
                    color: 'text.secondary',
                    '&.Mui-selected': {
                      color: 'primary.main',
                    },
                  }
                }}
              >
                <Tab label={t('charts.trending')} />
                <Tab label={t('charts.songs')} />
                <Tab label={t('charts.videos')} />
                <Tab label={t('charts.artists')} />
                {charts.genres && <Tab label={t('charts.genres')} />}
              </Tabs>

              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                {currentTab === 0 && charts.trending && (
                  <Grid container spacing={2}>
                    {charts.trending.items?.map((item: ChartItem, index: number) => (
                      <Grid item xs={12} sm={6} md={4} lg={3} key={`trending-${item.videoId || index}`}>
                        <motion.div variants={itemVariants}>
                          <UnifiedMusicCard
                            id={item.videoId}
                            title={item.title}
                            subtitle={item.artists.map(a => a.name).join(', ')}
                            coverUrl={item.thumbnails?.[0]?.url || '/placeholder-album.jpg'}
                            isPlayable={true}
                            badge={item.views ? {
                              text: item.views,
                              color: 'bg-red-600'
                            } : undefined}
                            onClick={() => handlePlayTrack(item)}
                          />
                        </motion.div>
                      </Grid>
                    ))}
                  </Grid>
                )}

                {currentTab === 1 && charts.songs && (
                  <Grid container spacing={2}>
                    {charts.songs?.map((item: ChartItem, index: number) => (
                      <Grid item xs={12} sm={6} md={4} lg={3} key={`song-${item.videoId || index}`}>
                        <motion.div variants={itemVariants}>
                          <UnifiedMusicCard
                            id={item.videoId}
                            title={`${index + 1}. ${item.title}`}
                            subtitle={item.artists.map(a => a.name).join(', ')}
                            coverUrl={item.thumbnails?.[0]?.url || '/placeholder-album.jpg'}
                            isPlayable={true}
                            onClick={() => handlePlayTrack(item)}
                          />
                        </motion.div>
                      </Grid>
                    ))}
                  </Grid>
                )}

                {currentTab === 2 && charts.videos && (
                  <Grid container spacing={2}>
                    {charts.videos?.map((item: ChartItem, index: number) => (
                      <Grid item xs={12} sm={6} md={4} lg={3} key={`video-${item.videoId || index}`}>
                        <motion.div variants={itemVariants}>
                          <UnifiedMusicCard
                            id={item.videoId}
                            title={`${index + 1}. ${item.title}`}
                            subtitle={item.artists.map(a => a.name).join(', ')}
                            coverUrl={item.thumbnails?.[0]?.url || '/placeholder-album.jpg'}
                            isPlayable={true}
                            badge={item.views ? {
                              text: item.views,
                              color: 'bg-red-600'
                            } : undefined}
                            onClick={() => handlePlayTrack(item)}
                          />
                        </motion.div>
                      </Grid>
                    ))}
                  </Grid>
                )}

                {currentTab === 3 && charts.artists && (
                  <Grid container spacing={2}>
                    {charts.artists?.map((artist: any, index: number) => (
                      <Grid item xs={12} sm={6} md={4} lg={3} key={`artist-${artist.id || index}`}>
                        <motion.div variants={itemVariants}>
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
                            onClick={() => artist.id && router.push(`/artist/${artist.id}`)}
                          >
                            <CardMedia
                              component="div"
                              sx={{ pt: '100%', position: 'relative' }}
                            >
                              <Image
                                src={artist.thumbnails?.[0]?.url || '/placeholder-artist.jpg'}
                                alt={artist.name}
                                fill
                                style={{ objectFit: 'cover' }}
                              />
                              <Box
                                sx={{
                                  position: 'absolute',
                                  top: 8,
                                  left: 8,
                                  bgcolor: 'background.paper',
                                  color: 'text.primary',
                                  borderRadius: '50%',
                                  width: 28,
                                  height: 28,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 'bold',
                                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                }}
                              >
                                {index + 1}
                              </Box>
                            </CardMedia>
                            <CardContent>
                              <Typography variant="h6" gutterBottom>
                                {artist.name}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {artist.subscribers || t('charts.artist')}
                              </Typography>
                            </CardContent>
                          </Card>
                        </motion.div>
                      </Grid>
                    ))}
                  </Grid>
                )}

                {currentTab === 4 && charts.genres && (
                  <Grid container spacing={2}>
                    {charts.genres?.map((genre: any, index: number) => (
                      <Grid item xs={12} sm={6} md={4} key={`genre-${index}`}>
                        <motion.div variants={itemVariants}>
                          <Card
                            sx={{
                              display: 'flex',
                              borderRadius: 2,
                              overflow: 'hidden',
                              transition: 'all 0.3s ease',
                              '&:hover': {
                                transform: 'translateY(-5px)',
                                boxShadow: '0 8px 16px rgba(0,0,0,0.2)'
                              }
                            }}
                            onClick={() => genre.params && router.push(`/explore/genre/${genre.title.toLowerCase()}?params=${encodeURIComponent(genre.params)}&source=youtube`)}
                          >
                            <Box sx={{ width: '40%', position: 'relative', minHeight: 140 }}>
                              <Image
                                src={genre.thumbnails?.[0]?.url || '/placeholder-genre.jpg'}
                                alt={genre.title}
                                fill
                                style={{ objectFit: 'cover' }}
                              />
                            </Box>
                            <Box sx={{ display: 'flex', flexDirection: 'column', width: '60%' }}>
                              <CardContent sx={{ flex: '1 0 auto' }}>
                                <Typography component="div" variant="h6">
                                  {genre.title}
                                </Typography>
                                <Typography variant="subtitle1" color="text.secondary" component="div">
                                  {t('charts.popularGenre')}
                                </Typography>
                              </CardContent>
                              <Box sx={{ display: 'flex', alignItems: 'center', pl: 1, pb: 1 }}>
                                <Button
                                  size="small"
                                  startIcon={<PlayArrow />}
                                  sx={{ ml: 1 }}
                                >
                                  {t('common.explore')}
                                </Button>
                              </Box>
                            </Box>
                          </Card>
                        </motion.div>
                      </Grid>
                    ))}
                  </Grid>
                )}
              </motion.div>
            </Box>
          )}

          {!charts && !loading && !error && (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <Typography variant="h6" gutterBottom>
                {t('explore.selectCountry')}
              </Typography>
              <ServerStatus showDetailed={true} />
              <Button
                variant="contained"
                color="primary"
                startIcon={<Refresh />}
                onClick={() => fetchCharts('ZZ')} // ZZ = Global
                sx={{ mt: 2 }}
              >
                {t('common.loadGlobal')}
              </Button>
            </Box>
          )}
        </>
      )}
    </Container>
  );
}
