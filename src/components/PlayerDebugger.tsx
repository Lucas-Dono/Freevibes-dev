'use client';

import React, { useEffect, useState } from 'react';
import { usePlayer } from '@/contexts/PlayerContext';

// Declaración de tipos para la API de YouTube
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | null;
    _debugYTPlayer?: any;
  }
}

interface PlayerDebuggerProps {
  playerId: string;
}

const PlayerDebugger: React.FC<PlayerDebuggerProps> = ({ playerId }) => {
  const { player, currentTrack, isPlaying, volume, duration, currentTime } = usePlayer();
  const [playerState, setPlayerState] = useState<string>('UNSTARTED');
  const [playerReady, setPlayerReady] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!player) return;

    const updatePlayerState = () => {
      if (!player.getPlayerState) return;
      
      const state = player.getPlayerState();
      const states: { [key: number]: string } = {
        [-1]: 'UNSTARTED',
        0: 'ENDED',
        1: 'PLAYING',
        2: 'PAUSED',
        3: 'BUFFERING',
        5: 'CUED'
      };
      
      setPlayerState(states[state] || 'UNKNOWN');
    };

    const handleReady = () => {
      setPlayerReady(true);
      setError(null);
    };

    const handleError = (event: any) => {
      setError(`Error: ${event.data}`);
    };

    player.addEventListener('onStateChange', updatePlayerState);
    player.addEventListener('onReady', handleReady);
    player.addEventListener('onError', handleError);

    return () => {
      player.removeEventListener('onStateChange', updatePlayerState);
      player.removeEventListener('onReady', handleReady);
      player.removeEventListener('onError', handleError);
    };
  }, [player]);

  return (
    <div className="fixed bottom-20 right-4 bg-black/80 text-white p-4 rounded-lg shadow-lg z-50 max-w-md">
      <h3 className="text-lg font-bold mb-2">Player Debug Info</h3>
      <div className="space-y-2 text-sm">
        <p>Player ID: {playerId}</p>
        <p>Player Ready: {playerReady ? 'Yes' : 'No'}</p>
        <p>Current State: {playerState}</p>
        <p>Is Playing: {isPlaying ? 'Yes' : 'No'}</p>
        <p>Volume: {volume}%</p>
        <p>Duration: {duration.toFixed(2)}s</p>
        <p>Current Time: {currentTime.toFixed(2)}s</p>
        {currentTrack && (
          <>
            <p>Current Track: {currentTrack.title}</p>
            <p>Artist: {currentTrack.artist}</p>
          </>
        )}
        {error && <p className="text-red-500">Error: {error}</p>}
      </div>
    </div>
  );
};

export default PlayerDebugger; 