'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface PlayerControlsProps {
  isPlaying: boolean;
  volume: number;
  onPlay: () => void;
  onPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  isMuted: boolean;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
  isPlaying,
  volume,
  onPlay,
  onPause,
  onPrevious,
  onNext,
  onVolumeChange,
  onToggleMute,
  isMuted,
}) => {
  const [isHoveringVolume, setIsHoveringVolume] = useState(false);
  const [localVolume, setLocalVolume] = useState(volume);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setLocalVolume(newVolume);
    onVolumeChange(newVolume);
  };

  // Variantes para animaciones de botones
  const buttonVariants = {
    hover: { scale: 1.1, transition: { duration: 0.2 } },
    tap: { scale: 0.95, transition: { duration: 0.1 } },
  };

  const volumeIconPath = () => {
    if (isMuted || volume === 0) {
      return "M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z";
    } else if (volume < 0.5) {
      return "M5 9v6h4l5 5V4L9 9H5zm7-7v3.93c3.3.97 5.67 4.1 5.67 7.07 0 2.97-2.37 6.1-5.67 7.07V22C18.53 19.92 22 16.28 22 12S18.53 4.08 12 2zM7 13v-2h3.07L7 13z";
    } else {
      return "M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z";
    }
  };

  return (
    <div className="flex flex-col items-center">
      {/* Controles principales */}
      <div className="flex items-center space-x-6">
        {/* Botón anterior */}
        <motion.button
          className="text-white/80 hover:text-white focus:outline-none"
          aria-label="Anterior"
          onClick={onPrevious}
          variants={buttonVariants}
          whileHover="hover"
          whileTap="tap"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"></path>
          </svg>
        </motion.button>

        {/* Botón Play/Pause */}
        <motion.button
          className="bg-white rounded-full p-3 text-primary hover:bg-opacity-90 focus:outline-none"
          aria-label={isPlaying ? "Pausar" : "Reproducir"}
          onClick={isPlaying ? onPause : onPlay}
          variants={buttonVariants}
          whileHover="hover"
          whileTap="tap"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            {isPlaying ? (
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path>
            ) : (
              <path d="M8 5v14l11-7z"></path>
            )}
          </svg>
        </motion.button>

        {/* Botón siguiente */}
        <motion.button
          className="text-white/80 hover:text-white focus:outline-none"
          aria-label="Siguiente"
          onClick={onNext}
          variants={buttonVariants}
          whileHover="hover"
          whileTap="tap"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"></path>
          </svg>
        </motion.button>
      </div>

      {/* Control de volumen */}
      <div
        className="mt-6 flex items-center space-x-2 relative"
        onMouseEnter={() => setIsHoveringVolume(true)}
        onMouseLeave={() => setIsHoveringVolume(false)}
      >
        <motion.button
          className="text-white/80 hover:text-white focus:outline-none"
          aria-label={isMuted ? "Activar sonido" : "Silenciar"}
          onClick={onToggleMute}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d={volumeIconPath()}></path>
          </svg>
        </motion.button>

        <motion.div
          className="flex items-center"
          initial={{ width: 0, opacity: 0 }}
          animate={{
            width: isHoveringVolume ? 100 : 0,
            opacity: isHoveringVolume ? 1 : 0
          }}
          transition={{ duration: 0.2 }}
        >
          {isHoveringVolume && (
            <div className="relative w-[100px]">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={localVolume}
                onChange={handleVolumeChange}
                className="w-full h-2 bg-gray-700 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #7C3AED ${localVolume * 100}%, #374151 ${localVolume * 100}%)`,
                }}
              />
              <div
                className="absolute top-0 left-0 h-2 bg-gradient-to-r from-primary to-accent rounded-full pointer-events-none"
                style={{width: `${localVolume * 100}%`}}
              />
              <div
                className="absolute top-[-4px] left-0 w-3 h-3 bg-white rounded-full pointer-events-none shadow-md"
                style={{left: `calc(${localVolume * 100}% - 6px)`}}
              />
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};
