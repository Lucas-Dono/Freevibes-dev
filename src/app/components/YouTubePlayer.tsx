'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePlayer } from '@/contexts/PlayerContext';

// Exportar un indicador para informar a quienes importan este componente que debe ser cargado dinámicamente
export const dynamic = 'force-dynamic';
export const shouldLoadDynamically = true;

interface YouTubePlayerProps {
  className?: string;
}

const YouTubePlayer: React.FC<YouTubePlayerProps> = ({ className }) => {
  console.log('[YouTubePlayer] 🔄 Renderizando componente YouTubePlayer');
  
  // Estado para asegurar que el componente solo se renderice en el cliente
  const [isMounted, setIsMounted] = useState(false);
  
  // Efecto para actualizar el estado cuando el componente está montado (sólo en el cliente)
  useEffect(() => {
    console.log('[YouTubePlayer] 🔄 Componente montado en el cliente');
    setIsMounted(true);
    
    return () => {
      console.log('[YouTubePlayer] 🧹 Limpieza del componente YouTubePlayer');
    };
  }, []);
  
  // Si no está montado (server-side), no renderizar nada
  if (!isMounted) {
    console.log('[YouTubePlayer] ⚠️ No está montado, devolviendo placeholder');
    return <div className={`youtube-player ${className || ''} h-16 bg-gray-800 rounded-md`} />;
  }
  
  // Obtener estado y funciones del contexto
  const {
    currentTrack,
    isPlaying,
    volume,
    currentTime,
    duration,
    togglePlay,
    setVolume, 
    seekTo,
    nextTrack,
    previousTrack
  } = usePlayer();

  console.log('[YouTubePlayer] 📊 Estado actual:', {
    currentTrack: currentTrack ? {
      title: currentTrack.title,
      artist: currentTrack.artist,
      youtubeId: currentTrack.youtubeId
    } : null,
    isPlaying,
    volume,
    currentTime,
    duration
  });

  // Estados locales para la UI
  const [progress, setProgress] = useState(0);
  const [volumeBeforeMute, setVolumeBeforeMute] = useState(100);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const volumeBarRef = useRef<HTMLDivElement>(null);
  const [isMuted, setIsMuted] = useState(volume === 0);
  const [timeDisplayed, setTimeDisplayed] = useState('0:00');
  const [durationDisplayed, setDurationDisplayed] = useState('0:00');
  
  // Efecto para actualizar la visualización del tiempo
  useEffect(() => {
    // Actualizar la visualización del tiempo
    const updateTimeDisplay = () => {
      const formattedTime = formatTime(currentTime);
      const formattedDuration = formatTime(duration);
      
      setTimeDisplayed(formattedTime);
      setDurationDisplayed(formattedDuration);
      
      // Calcular el progreso en porcentaje
      if (duration > 0) {
        const newProgress = (currentTime / duration) * 100;
        setProgress(newProgress);
        
        // Log cada 5 segundos para evitar spam en la consola
        if (Math.floor(currentTime) % 5 === 0) {
          console.log('[YouTubePlayer] ⏱️ Actualización periódica:', {
            currentTime: formattedTime,
            duration: formattedDuration,
            progress: `${newProgress.toFixed(1)}%`
          });
        }
      } else {
        setProgress(0);
      }
    };
    
    // Llamar a la función para actualizar inmediatamente
    updateTimeDisplay();
    
    // Crear un intervalo para actualizar periódicamente
    const interval = setInterval(updateTimeDisplay, 1000);
    
    // Limpiar el intervalo al desmontar
    return () => clearInterval(interval);
  }, [currentTime, duration]);
  
  // Función para formatear el tiempo en formato mm:ss
  const formatTime = (time: number): string => {
    if (!time || isNaN(time)) return '0:00';
    
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Función para manejar clics en la barra de progreso
  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !duration) return;
    
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const barWidth = rect.width;
    
    // Calcular el tiempo correspondiente
    const seekTime = (clickX / barWidth) * duration;
    
    console.log('[YouTubePlayer] ⏩ Buscando a:', formatTime(seekTime));
    
    // Buscar a ese tiempo
    seekTo(seekTime);
  };
  
  // Función para manejar cambios en el volumen
  const handleVolumeChange = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!volumeBarRef.current) return;
    
    const rect = volumeBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const barWidth = rect.width;
    
    // Calcular el nuevo volumen (0-100)
    let newVolume = Math.round((clickX / barWidth) * 100);
    newVolume = Math.max(0, Math.min(100, newVolume));
    
    console.log('[YouTubePlayer] 🔊 Volumen cambiado a:', newVolume);
    
    // Cambiar el volumen
    setVolume(newVolume);
    
    // Actualizar el estado de silencio
    setIsMuted(newVolume === 0);
  };
  
  // Función para alternar silencio
  const toggleMute = () => {
    console.log('[YouTubePlayer] 🔇 Alternando silencio, estado actual:', isMuted);
    
    if (isMuted) {
      // Restaurar volumen anterior
      console.log('[YouTubePlayer] 🔊 Restaurando volumen a:', volumeBeforeMute || 50);
      setVolume(volumeBeforeMute || 50);
      setIsMuted(false);
    } else {
      // Guardar volumen actual y silenciar
      console.log('[YouTubePlayer] 🔇 Silenciando, guardando volumen:', volume);
      setVolumeBeforeMute(volume);
      setVolume(0);
      setIsMuted(true);
    }
  };

  // Si no hay pista actual, mostrar mensaje
  if (!currentTrack) {
    return (
      <div 
        className={`youtube-player ${className || ''} flex items-center justify-center h-16 bg-gray-800 text-gray-400 rounded-md`}
        suppressHydrationWarning
      >
        <p>No hay canción seleccionada</p>
      </div>
    );
  }

  return (
    <div 
      className={`youtube-player ${className || ''} p-3 bg-gray-800 rounded-md text-white`}
      suppressHydrationWarning
    >
      <div className="flex items-center justify-between">
        {/* Información de la pista */}
        <div className="flex items-center">
          <img 
            src={currentTrack.albumCover || currentTrack.cover || '/images/default-cover.jpg'} 
            alt={currentTrack.title}
            className="w-10 h-10 mr-3 rounded-sm"
          />
          <div>
            <div className="font-semibold">{currentTrack.title}</div>
            <div className="text-sm text-gray-400">{currentTrack.artist}</div>
          </div>
        </div>
        
        {/* Controles */}
        <div className="flex items-center space-x-3">
          <button 
            onClick={previousTrack}
            className="p-2 rounded-full hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-600"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"></path>
            </svg>
          </button>
          
          <button 
            onClick={togglePlay}
            className="p-2 rounded-full bg-white text-black hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-600"
          >
            {isPlaying ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path>
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"></path>
              </svg>
            )}
          </button>
          
          <button 
            onClick={nextTrack}
            className="p-2 rounded-full hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-600"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"></path>
            </svg>
          </button>
        </div>
        
        {/* Control de volumen */}
        <div className="flex items-center space-x-2">
          <button 
            onClick={toggleMute}
            className="p-1 rounded-full hover:bg-gray-700 focus:outline-none"
          >
            {isMuted ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"></path>
              </svg>
            ) : volume > 50 ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"></path>
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"></path>
              </svg>
            )}
          </button>
          
          <div 
            className="w-24 h-2 bg-gray-600 rounded cursor-pointer"
            ref={volumeBarRef}
            onClick={handleVolumeChange}
          >
            <div 
              className="h-full bg-white rounded"
              style={{ width: `${volume}%` }}
            ></div>
          </div>
        </div>
      </div>
      
      {/* Barra de progreso */}
      <div className="mt-4">
        <div className="flex justify-between text-xs mb-1">
          <span>{timeDisplayed}</span>
          <span>{durationDisplayed}</span>
        </div>
        <div 
          className="h-2 bg-gray-600 rounded cursor-pointer"
          ref={progressBarRef}
          onClick={handleProgressBarClick}
        >
          <div 
            className="h-full bg-red-500 rounded"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default YouTubePlayer; 