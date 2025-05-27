import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { usePlayer } from '@/contexts/PlayerContext';

const MobileNowPlayingBar: React.FC = () => {
  const { currentTrack, isPlaying, togglePlay } = usePlayer();
  
  if (!currentTrack) return null;

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-14 left-0 right-0 z-20 mx-2 mb-2"
    >
      {/* Fondo con glassmorphism */}
      <div className="bg-gradient-to-r from-slate-800/95 via-slate-700/95 to-slate-800/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
        {/* Barra de progreso superior */}
        <div className="h-1 bg-gray-700">
          <motion.div
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
            initial={{ width: "0%" }}
            animate={{ width: "45%" }}
            transition={{ duration: 2, ease: "easeInOut" }}
          />
        </div>
        
        {/* Contenido principal */}
        <div className="flex items-center p-3 space-x-3">
          {/* Artwork con efectos */}
          <div className="relative">
            {/* Glow effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl blur-sm opacity-50" />
            
            {/* Imagen */}
            <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-gradient-to-br from-purple-500 to-pink-500">
              {currentTrack.cover ? (
                <Image
                  src={currentTrack.cover}
                  alt={currentTrack.title}
                  width={48}
                  height={48}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                  </svg>
                </div>
              )}
            </div>
            
            {/* Indicador de reproducción */}
            {isPlaying && (
              <motion.div
                className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-800 flex items-center justify-center"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <div className="w-1.5 h-1.5 bg-white rounded-full" />
              </motion.div>
            )}
          </div>

          {/* Información de la canción */}
          <div className="flex-1 min-w-0">
            <motion.h4 
              className="text-sm font-semibold text-white truncate"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              key={currentTrack.title}
            >
              {currentTrack.title}
            </motion.h4>
            <motion.p 
              className="text-xs text-gray-300 truncate"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              key={currentTrack.artist}
            >
              {currentTrack.artist}
            </motion.p>
          </div>

          {/* Controles de reproducción */}
          <div className="flex items-center space-x-2">
            {/* Botón de play/pause principal */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={togglePlay}
              className="relative w-12 h-12 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center shadow-lg"
            >
              {/* Efecto de ondas cuando está reproduciendo */}
              {isPlaying && (
                <>
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-purple-400"
                    animate={{ scale: [1, 1.5], opacity: [0.8, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-pink-400"
                    animate={{ scale: [1, 1.5], opacity: [0.8, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
                  />
                </>
              )}
              
              {/* Icono */}
              <motion.div
                key={isPlaying ? 'pause' : 'play'}
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", bounce: 0.5 }}
              >
                {isPlaying ? (
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                )}
              </motion.div>
            </motion.button>

            {/* Botón de siguiente (opcional) */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
            >
              <svg className="w-4 h-4 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
              </svg>
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default MobileNowPlayingBar; 