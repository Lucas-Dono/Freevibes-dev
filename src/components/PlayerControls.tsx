'use client';

import React, { useState } from 'react';
import { usePlayer, Track } from '@/contexts/PlayerContext';

const PlayerControls: React.FC = () => {
  const { togglePlay, playTrack, isPlaying, currentTrack } = usePlayer();
  
  // Estado para el modo de repetición (se puede implementar luego)
  const [repeatMode, setRepeatMode] = useState<'OFF' | 'ONE' | 'ALL'>('OFF');

  // Alternar reproducción/pausa
  const handlePlayPause = () => {
    togglePlay();
  };

  // Reproducir una canción
  const handlePlayTrack = (track: Track) => {
    playTrack(track);
  };

  return (
    <div>
      {/* Renderizar los controles del reproductor */}
      <div>
        <button onClick={handlePlayPause}>
          {isPlaying ? 'Pausar' : 'Reproducir'}
        </button>
        {currentTrack && (
          <div>
            <p>Reproduciendo: {currentTrack.title} - {currentTrack.artist}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerControls; 