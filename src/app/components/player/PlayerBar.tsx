'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { usePlayer, Track } from '@/contexts/PlayerContext';

export const PlayerBar: React.FC = () => {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  
  // Obtener información del reproductor desde el contexto
  const { 
    currentTrack, 
    isPlaying, 
    currentTime: trackCurrentTime,
    duration: trackDuration,
    togglePlay,
    nextTrack,
    previousTrack,
    seekTo,
    volume: contextVolume,
    setVolume: setContextVolume
  } = usePlayer();
  
  // No mostrar en las páginas de login y registro o cuando el usuario no está autenticado
  if (pathname === '/login' || pathname === '/register' || !isAuthenticated) {
    return null;
  }
  
  // Estado del reproductor
  const [volume, setVolume] = useState(contextVolume * 100);
  const [progress, setProgress] = useState(0);
  const [isMuted, setIsMuted] = useState(contextVolume === 0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVolumeVisible, setIsVolumeVisible] = useState(false);
  const [currentTimeFormatted, setCurrentTimeFormatted] = useState('0:00');
  const [totalTimeFormatted, setTotalTimeFormatted] = useState('0:00');
  
  // Referencia para la barra de progreso
  const progressBarRef = useRef<HTMLDivElement>(null);
  
  // Actualizar el progreso y los tiempos formateados cuando cambia el tiempo actual o la duración
  useEffect(() => {
    if (trackDuration > 0) {
      setProgress((trackCurrentTime / trackDuration) * 100);
    } else {
      setProgress(0);
    }
    
    setCurrentTimeFormatted(formatTime(trackCurrentTime));
    setTotalTimeFormatted(formatTime(trackDuration));
  }, [trackCurrentTime, trackDuration]);
  
  // Actualizar el volumen del componente cuando cambia en el contexto
  useEffect(() => {
    setVolume(contextVolume * 100);
    setIsMuted(contextVolume === 0);
  }, [contextVolume]);
  
  // Función para formatear el tiempo
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (progressBarRef.current && trackDuration > 0) {
      const rect = progressBarRef.current.getBoundingClientRect();
      const clickPosition = e.clientX - rect.left;
      const percentage = (clickPosition / rect.width);
      const newTime = percentage * trackDuration;
      seekTo(newTime);
    }
  };
  
  const handleTogglePlay = () => {
    console.log("PlayerBar: togglePlay llamado, isPlaying actual:", isPlaying);
    togglePlay();
  };
  
  const handleToggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      setContextVolume(volume / 100);
    } else {
      setIsMuted(true);
      setContextVolume(0);
    }
  };
  
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setVolume(value);
    setContextVolume(value / 100);
    
    if (value === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      setIsMuted(false);
    }
  };
  
  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };
  
  // Si no hay canción actual, no mostrar el reproductor
  if (!currentTrack) {
    return null;
  }
  
  // Validar la URL de la portada para evitar errores
  const coverUrl = currentTrack?.cover || '/placeholder-album.jpg';
  
  console.log("PlayerBar rendering with currentTrack:", currentTrack.title, "isPlaying:", isPlaying);
  
  return (
    <AnimatePresence>
      <motion.div 
        className="fixed bottom-0 left-0 right-0 bg-gray-900/90 backdrop-blur-xl border-t border-white/10 z-40"
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.2 }}
      >
        <div className="max-w-7xl mx-auto">
          {/* Panel expandido */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                className="bg-gray-900/70 backdrop-blur-lg"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="max-w-7xl mx-auto p-6">
                  <div className="flex">
                    {/* Portada ampliada e información del álbum */}
                    <div className="w-1/3 pr-8">
                      <motion.div 
                        className="relative aspect-square rounded-lg overflow-hidden shadow-2xl mb-4"
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                      >
                        <img 
                          src={coverUrl} 
                          alt={currentTrack.title}
                          className="w-full h-full object-cover"
                        />
                      </motion.div>
                      <motion.h2 
                        className="text-xl font-bold mb-1"
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                      >
                        {currentTrack.title}
                      </motion.h2>
                      <motion.p 
                        className="text-gray-400"
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                      >
                        {currentTrack.artist}
                      </motion.p>
                      <motion.p 
                        className="text-gray-500 text-sm"
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.4 }}
                      >
                        {currentTrack.album}
                      </motion.p>
                    </div>
                    
                    {/* Controles ampliados y visualizaciones */}
                    <div className="flex-1">
                      {/* Visualización de YouTube */}
                      <div className="p-4 rounded-lg bg-black/30 mb-4 h-56 flex items-center justify-center">
                        {/* Aquí podríamos incrustar un iframe de YouTube con autoplay=0, pero mantenemos oculto el player principal */}
                        <span className="text-gray-400 text-sm">
                          ID de YouTube: {currentTrack.youtubeId || 'No disponible'}
                        </span>
                      </div>
                      
                      {/* Información adicional */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 rounded-lg bg-black/20">
                          <h3 className="text-gray-300 text-xs mb-1">Duración</h3>
                          <p className="text-white font-medium">{totalTimeFormatted}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-black/20">
                          <h3 className="text-gray-300 text-xs mb-1">Album</h3>
                          <p className="text-white font-medium truncate">{currentTrack.album || 'Desconocido'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          <div className="flex items-center px-4 h-20">
            {/* Información de la canción */}
            <div className="flex items-center w-1/4">
              <motion.div 
                className="relative w-12 h-12 rounded-full overflow-hidden mr-3 shadow-none"
                whileHover={{ scale: 1.08 }}
                animate={isPlaying ? { rotate: [0, 360] } : { rotate: 0 }}
                transition={isPlaying ? 
                  { rotate: { repeat: Infinity, duration: 16, ease: "linear" } } : 
                  { duration: 0.3 }
                }
                style={{ pointerEvents: 'none' }}
              >
                {/* Diseño de vinilo */}
                <div className="absolute inset-0 bg-black rounded-full opacity-90"></div>
                
                {/* Surcos del vinilo */}
                {[...Array(3)].map((_, i) => (
                  <div 
                    key={i} 
                    className="absolute inset-0 border border-gray-600 rounded-full opacity-30"
                    style={{ 
                      transform: `scale(${0.85 - i * 0.15})`,
                      borderWidth: '1px' 
                    }}
                  ></div>
                ))}
                
                {/* Portada del álbum en el centro */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-6 h-6 rounded-full overflow-hidden border-2 border-gray-800">
                    <img 
                      src={coverUrl} 
                      alt={currentTrack.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
                
                {/* Agujero central del vinilo */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-300"></div>
                </div>
              </motion.div>
              <div className="overflow-hidden">
                <motion.h3 
                  className="font-medium text-sm truncate"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  {currentTrack.title}
                </motion.h3>
                <motion.p 
                  className="text-gray-400 text-xs truncate"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  {currentTrack.artist}
                </motion.p>
              </div>
            </div>
            
            {/* Controles de reproducción */}
            <div className="flex flex-col items-center justify-center flex-1 px-4 space-y-2">
              {/* Controles principales */}
              <div className="flex items-center justify-center space-x-4">
                {/* Botón anterior */}
                <motion.button 
                  className="text-gray-400 hover:text-white"
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={previousTrack}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                  </svg>
                </motion.button>
                
                {/* Botón play/pause */}
                <motion.button
                  className="bg-white text-black rounded-full w-8 h-8 flex items-center justify-center"
                  onClick={handleTogglePlay}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.3 }}
                  >
                    {isPlaying ? (
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </motion.div>
                </motion.button>
                
                {/* Botón siguiente */}
                <motion.button 
                  className="text-gray-400 hover:text-white"
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={nextTrack}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                  </svg>
                </motion.button>
              </div>
              
              {/* Barra de progreso */}
              <div className="w-full flex items-center space-x-2">
                <span className="text-gray-400 text-xs w-8 text-right">{currentTimeFormatted}</span>
                <div 
                  className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden cursor-pointer relative"
                  onClick={handleProgressClick}
                  ref={progressBarRef}
                >
                  <motion.div 
                    className="absolute inset-0 flex items-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    {/* Partículas de barra de progreso */}
                    {[...Array(10)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="absolute h-1 w-1 rounded-full bg-primary-lighter"
                        initial={{ 
                          x: `${(i * 10)}%`, 
                          opacity: Math.random() * 0.7 + 0.3
                        }}
                        animate={{ 
                          y: [0, -3, 0, 3, 0],
                        }}
                        transition={{ 
                          repeat: Infinity, 
                          duration: 2 + Math.random() * 3,
                          delay: i * 0.2
                        }}
                        style={{
                          left: `${(i * 10)}%`,
                          opacity: i * 10 <= progress ? 1 : 0.2,
                        }}
                      />
                    ))}
                  </motion.div>
                  <div 
                    className="h-full bg-gradient-to-r from-primary to-secondary"
                    style={{ width: `${progress}%` }}
                  >
                  </div>
                  <motion.div 
                    className="absolute top-1/2 w-3 h-3 rounded-full bg-white -translate-y-1/2 -ml-1.5 shadow-lg opacity-0 hover:opacity-100 hover:scale-110 transition-opacity"
                    style={{ left: `${progress}%` }}
                  />
                </div>
                <span className="text-gray-400 text-xs w-8 text-left">{totalTimeFormatted}</span>
              </div>
            </div>
            
            {/* Controles adicionales */}
            <div className="flex items-center justify-end space-x-3 w-1/4">
              {/* Control de volumen */}
              <div className="relative flex items-center">
                <motion.button 
                  className="text-gray-400 hover:text-white"
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleToggleMute}
                  onMouseEnter={() => setIsVolumeVisible(true)}
                >
                  {isMuted || volume === 0 ? (
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                    </svg>
                  ) : volume <= 50 ? (
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                    </svg>
                  )}
                </motion.button>
                
                <AnimatePresence>
                  {isVolumeVisible && (
                    <motion.div 
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-gray-800 rounded-lg p-2 shadow-lg w-32"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.2 }}
                      onMouseLeave={() => setIsVolumeVisible(false)}
                    >
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={volume}
                        onChange={handleVolumeChange}
                        className="w-full accent-primary"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              {/* Botón expandir */}
              <motion.button 
                className="text-gray-400 hover:text-white"
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
                onClick={toggleExpand}
              >
                {isExpanded ? (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z" />
                  </svg>
                )}
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};