'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlayerControls } from './PlayerControls';
import { usePlayer, LyricLine } from '@/contexts/PlayerContext';
import Image from 'next/image';

interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  audioSrc: string;
  duration: number;
  youtubeId?: string;
}

interface MusicPlayerProps {
  playlist: Song[];
  initialSongIndex?: number;
  onClose?: () => void;
  minimized?: boolean;
  onToggleMinimize?: () => void;
}

export const MusicPlayer: React.FC<MusicPlayerProps> = ({
  playlist,
  initialSongIndex = 0,
  onClose,
  minimized = false,
  onToggleMinimize,
}) => {
  const [currentSongIndex, setCurrentSongIndex] = useState(initialSongIndex);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [visualizerMode, setVisualizerMode] = useState<'wave' | 'bars' | 'circle'>('wave');
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const currentSong = playlist[currentSongIndex];
  // Obtener las letras del contexto del reproductor
  const { lyrics } = usePlayer();

  // Referencia al timeout para actualizar letras
  const lyricsUpdateInterval = useRef<NodeJS.Timeout | null>(null);

  // Efecto para actualizar las letras continuamente
  useEffect(() => {
    // Solo activar el intervalo si estamos reproduciendo y tenemos letras
    if (isPlaying && lyrics?.synced?.length > 0) {
      // Crear un intervalo para actualizar las letras cada 100ms
      lyricsUpdateInterval.current = setInterval(() => {
        // Forzar actualización del componente para mostrar las letras actualizadas
        // Esto funciona porque getCurrentLyrics se llamará con el tiempo actualizado
        forceUpdate();
      }, 100);
    }
    
    // Limpiar el intervalo cuando se detenga la reproducción
    return () => {
      if (lyricsUpdateInterval.current) {
        clearInterval(lyricsUpdateInterval.current);
        lyricsUpdateInterval.current = null;
      }
    };
  }, [isPlaying, lyrics]);
  
  // Función para forzar actualización del componente
  const [, updateState] = useState<any>();
  const forceUpdate = useCallback(() => updateState({}), []);

  // Configuración inicial del audio
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  // Actualizar el tiempo actual durante la reproducción
  useEffect(() => {
    const updateTime = () => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
      }
    };

    const audio = audioRef.current;
    audio?.addEventListener('timeupdate', updateTime);

    return () => {
      audio?.removeEventListener('timeupdate', updateTime);
    };
  }, []);

  // Reproducir automáticamente la siguiente canción
  useEffect(() => {
    const handleEnded = () => {
      playNextSong();
    };

    const audio = audioRef.current;
    audio?.addEventListener('ended', handleEnded);

    return () => {
      audio?.removeEventListener('ended', handleEnded);
    };
  }, [currentSongIndex, playlist]);

  // Controlar el inicio/pausa de la reproducción
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(error => {
          console.error('Error al reproducir:', error);
          setIsPlaying(false);
        });
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentSongIndex]);

  // Set up audio visualization
  useEffect(() => {
    if (!minimized) return;
    
    // Initialize audio context
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    if (audioRef.current && audioContextRef.current && !analyserRef.current) {
      const source = audioContextRef.current.createMediaElementSource(audioRef.current);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [minimized]);

  // Handle play/pause
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play();
        startVisualizer();
      } else {
        audioRef.current.pause();
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      }
    }
  }, [isPlaying]);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handlePrevious = () => {
    const newIndex = currentSongIndex === 0 ? playlist.length - 1 : currentSongIndex - 1;
    setCurrentSongIndex(newIndex);
    setCurrentTime(0);
    setIsPlaying(true);
  };

  const playNextSong = () => {
    const newIndex = currentSongIndex === playlist.length - 1 ? 0 : currentSongIndex + 1;
    setCurrentSongIndex(newIndex);
    setCurrentTime(0);
    setIsPlaying(true);
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  const handleToggleMute = () => {
    setIsMuted(!isMuted);
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (progressBarRef.current && audioRef.current) {
      const rect = progressBarRef.current.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      const newTime = pos * currentSong.duration;
      
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const progressPercentage = (currentTime / currentSong.duration) * 100;
  
  // Variantes para animaciones
  const playerVariants = {
    minimized: { 
      height: "72px",
      transition: { duration: 0.3, ease: "easeInOut" }
    },
    expanded: { 
      height: "auto", 
      transition: { duration: 0.3, ease: "easeInOut" }
    },
  };

  const coverVariants = {
    minimized: { 
      width: "56px", 
      height: "56px",
      transition: { duration: 0.3 }
    },
    expanded: { 
      width: "300px", 
      height: "300px",
      transition: { duration: 0.3 }
    }
  };

  // Start audio visualizer
  const startVisualizer = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas dimensions
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      
      analyser.getByteFrequencyData(dataArray);
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (visualizerMode === 'bars') {
        drawBars(ctx, canvas, dataArray, bufferLength);
      } else if (visualizerMode === 'wave') {
        drawWave(ctx, canvas, dataArray, bufferLength);
      } else if (visualizerMode === 'circle') {
        drawCircle(ctx, canvas, dataArray, bufferLength);
      }
    };
    
    draw();
  };
  
  const drawBars = (
    ctx: CanvasRenderingContext2D, 
    canvas: HTMLCanvasElement, 
    dataArray: Uint8Array, 
    bufferLength: number
  ) => {
    const barWidth = (canvas.width / bufferLength) * 2.5;
    let x = 0;
    
    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * canvas.height;
      
      const r = 149 + (dataArray[i] / 10);
      const g = 76 + (dataArray[i] / 20);
      const b = 233;
      
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
      
      x += barWidth + 1;
    }
  };
  
  const drawWave = (
    ctx: CanvasRenderingContext2D, 
    canvas: HTMLCanvasElement, 
    dataArray: Uint8Array, 
    bufferLength: number
  ) => {
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgb(124, 58, 237)';
    
    ctx.beginPath();
    
    const sliceWidth = canvas.width / bufferLength;
    let x = 0;
    
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = v * canvas.height / 2;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      
      x += sliceWidth;
    }
    
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
    
    // Add gradient under the line
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, 'rgba(124, 58, 237, 0.5)');
    gradient.addColorStop(1, 'rgba(124, 58, 237, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fill();
  };
  
  const drawCircle = (
    ctx: CanvasRenderingContext2D, 
    canvas: HTMLCanvasElement, 
    dataArray: Uint8Array, 
    bufferLength: number
  ) => {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 20;
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    for (let i = 0; i < bufferLength; i++) {
      const value = dataArray[i];
      const percent = value / 255;
      
      const angle = (i * 2 * Math.PI) / bufferLength;
      const length = radius * percent;
      
      const x1 = centerX + radius * Math.cos(angle);
      const y1 = centerY + radius * Math.sin(angle);
      
      const x2 = centerX + (radius + length / 2) * Math.cos(angle);
      const y2 = centerY + (radius + length / 2) * Math.sin(angle);
      
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      
      const hue = 270 + (i * 60 / bufferLength); // Purple to blue
      ctx.strokeStyle = `hsla(${hue}, 80%, 60%, 0.8)`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  };

  // Find current lyrics based on time
  const getCurrentLyrics = () => {
    // Verificar que tengamos letras sincronizadas desde el contexto
    if (!lyrics?.synced || lyrics.synced.length === 0) {
      return "";
    }
    
    // Buscar la letra actual basada en el tiempo de reproducción
    // La letra actual es la última cuyo tiempo es menor o igual al tiempo actual
    const currentTime = audioRef.current?.currentTime || 0;
    
    // Ordenar por tiempo y encontrar la letra actual
    let currentLyric = null;
    for (let i = 0; i < lyrics.synced.length; i++) {
      if (lyrics.synced[i].time <= currentTime) {
        currentLyric = lyrics.synced[i];
      } else {
        // Como las letras están ordenadas por tiempo, podemos salir del bucle
        // cuando encontremos una letra con tiempo mayor al actual
        break;
      }
    }
    
    // Agregar un console.log para depuración
    if (currentLyric) {
      console.log(`[MusicPlayer] 🎵 Tiempo actual: ${currentTime.toFixed(2)}s, Letra: "${currentLyric.text}", Tiempo letra: ${currentLyric.time.toFixed(2)}s`);
    }
    
    return currentLyric ? currentLyric.text : "";
  };

  const [imgError, setImgError] = useState(false);
  
  // Determinar la URL de la imagen
  let imageUrl = currentSong.cover;
  
  // Si es un video de YouTube y tiene youtubeId, crear URL de miniatura
  if (currentSong.youtubeId && !imageUrl) {
    // Intentar usar maxresdefault primero, con fallback a hqdefault
    imageUrl = imgError 
      ? `https://i.ytimg.com/vi/${currentSong.youtubeId}/hqdefault.jpg` 
      : `https://i.ytimg.com/vi/${currentSong.youtubeId}/maxresdefault.jpg`;
  }
  
  // Si no hay imagen, usar un placeholder
  if (!imageUrl) {
    imageUrl = '/images/default-album.png';
  }

  return (
    <motion.div 
      className="bg-gradient-to-br from-gray-900 to-gray-800 text-white rounded-lg shadow-xl overflow-hidden"
      initial="minimized"
      animate={minimized ? "minimized" : "expanded"}
      variants={playerVariants}
    >
      <audio 
        ref={audioRef} 
        src={currentSong.audioSrc} 
        preload="metadata"
      />

      {/* Barra de progreso superior */}
      <div 
        className="h-1 bg-gray-700 cursor-pointer"
        onClick={handleProgressClick}
        ref={progressBarRef}
      >
        <div 
          className="h-full bg-gradient-to-r from-primary to-accent"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>

      <div className="p-4">
        <div className="flex items-center">
          {/* Portada del álbum */}
          <motion.div 
            className="relative rounded-md overflow-hidden shadow-lg mr-4"
            variants={coverVariants}
          >
            <div className="h-full w-full rounded-full overflow-hidden bg-gray-800">
              <Image
                src={imageUrl}
                alt={`${currentSong.title} cover`}
                className="h-full w-full object-cover rounded-full"
                width={300}
                height={300}
                priority
                onError={() => {
                  if (!imgError && currentSong.youtubeId) {
                    setImgError(true);
                  }
                }}
              />
            </div>
            
            {!minimized && (
              <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300">
                <button 
                  className="bg-white rounded-full p-4"
                  onClick={handlePlayPause}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="black">
                    {isPlaying ? (
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path>
                    ) : (
                      <path d="M8 5v14l11-7z"></path>
                    )}
                  </svg>
                </button>
              </div>
            )}
          </motion.div>

          {/* Información de la canción */}
          <div className="flex-1">
            <h3 className="font-bold text-lg truncate">{currentSong.title}</h3>
            <p className="text-gray-300 truncate">{currentSong.artist}</p>
            <p className="text-gray-400 text-sm truncate">{currentSong.album}</p>
            
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(currentSong.duration)}</span>
            </div>
          </div>

          {/* Botones de control para vista minimizada */}
          {minimized && (
            <div className="flex items-center space-x-2">
              <button 
                className="p-2 text-white/80 hover:text-white focus:outline-none"
                onClick={handlePlayPause}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  {isPlaying ? (
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path>
                  ) : (
                    <path d="M8 5v14l11-7z"></path>
                  )}
                </svg>
              </button>
              
              <button 
                className="p-2 text-white/80 hover:text-white focus:outline-none"
                onClick={onToggleMinimize}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"></path>
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Controles completos (solo visible en modo expandido) */}
        <AnimatePresence>
          {!minimized && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-6"
            >
              <PlayerControls 
                isPlaying={isPlaying}
                volume={volume}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onPrevious={handlePrevious}
                onNext={playNextSong}
                onVolumeChange={handleVolumeChange}
                onToggleMute={handleToggleMute}
                isMuted={isMuted}
              />
              
              {/* Botón minimizar */}
              <div className="mt-6 flex justify-center">
                <button 
                  className="text-white/60 hover:text-white focus:outline-none"
                  onClick={onToggleMinimize}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"></path>
                  </svg>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}; 