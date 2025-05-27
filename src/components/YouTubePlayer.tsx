import React from 'react';
import YouTube, { YouTubeProps } from 'react-youtube';

interface YouTubePlayerProps {
  videoId: string;
  onReady: (player: any) => void;
  onEnd?: () => void;
}

const YouTubePlayer: React.FC<YouTubePlayerProps> = ({ videoId, onReady, onEnd }) => {
  const opts: YouTubeProps['opts'] = {
    height: '1',
    width: '1',
    playerVars: {
      autoplay: 1,
      enablejsapi: 1,
      origin: '*',
      controls: 0,
      disablekb: 1,
      fs: 0,
      iv_load_policy: 3,
      modestbranding: 1,
      rel: 0,
      showinfo: 0
    }
  };

  const handleReady: YouTubeProps['onReady'] = event => {
    onReady(event.target);
  };

  const handleEnd: YouTubeProps['onEnd'] = () => {
    console.log('[YouTubePlayer] Canción terminada, ejecutando callback');
    if (onEnd) {
      onEnd();
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: '-9999px',
      left: '-9999px',
      width: '1px',
      height: '1px',
      opacity: 0,
      pointerEvents: 'none',
      zIndex: -1
    }}>
      <YouTube 
        videoId={videoId} 
        opts={opts} 
        onReady={handleReady}
        onEnd={handleEnd}
      />
    </div>
  );
};

export default YouTubePlayer; 