import React from 'react';

// Icono de Spotify
export const SpotifyIcon = ({ className = 'w-6 h-6' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.901-.54-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.48.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
  </svg>
);

// Icono de Deezer
export const DeezerIcon = ({ className = 'w-6 h-6' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M18.81 4.16v3.03H24V4.16h-5.19zm0 12.54h5.19v-3.1h-5.19v3.1zm-6.5-6.27h5.19V7.41h-5.19v3.02zm0 6.27h5.19v-3.1h-5.19v3.1zm0 3.71h5.19v-3.09h-5.19v3.09zM0 20.41h5.19v-3.09H0v3.09zm0-3.73h5.19v-3.1H0v3.1zm0-6.27h5.19V7.4H0v3.01zM0 3.79h5.19V.54H0v3.25zm6.46 13.3h5.19v-3.1H6.46v3.1zm0-6.33h5.19V7.4H6.46v3.01zm6.45-3.19h5.19V4.16h-5.19v3.41z" />
  </svg>
);

// Icono de Last.fm
export const LastFmIcon = ({ className = 'w-6 h-6' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M10.599 11.569a1.874 1.874 0 00-2.52.7l-.44.76a.368.368 0 01-.12.159.376.376 0 01-.47-.06c-.64-.761-1.221-1.248-1.921-1.928A5.328 5.328 0 003.628 10a.27.27 0 00-.028 0 7.3 7.3 0 109.942 8.331.826.826 0 00-.722-.599.795.795 0 00-.8.489 5.63 5.63 0 01-5.4 3.542c-3.143 0-5.7-2.5-5.7-5.748 0-3.052 2.338-5.338 5.231-5.558a4.468 4.468 0 012.839.679.354.354 0 01.031.034.433.433 0 01-.071.6l-.661 1.22a1.948 1.948 0 00-.13 1.519 1.88 1.88 0 00.96 1.051 1.974 1.974 0 001.59.052 1.971 1.971 0 001.69-1.993 2.93 2.93 0 00-.8-2.05zm9.765 3.999a5.3 5.3 0 01-3.481 4.2 5.913 5.913 0 01-2.339.43.826.826 0 00-.722.599.8.8 0 00.8.489 7.073 7.073 0 003.054-.561 6.907 6.907 0 004.563-5.519.816.816 0 00-.607-.962.766.766 0 00-.955.599.27.27 0 01-.313.725z" />
  </svg>
);

// Icono de YouTube
export const YoutubeIcon = ({ className = 'w-6 h-6' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

// Icono de reloj
export const ClockIcon = ({ className = 'w-6 h-6' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 6v6l4 2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Icono de actualizar
export const RefreshIcon = ({ className = 'w-6 h-6' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M1 4v6h6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M23 20v-6h-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Icono de nota musical
export const MusicNoteIcon = ({ className = 'w-6 h-6' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M9 18V5l12-2v13" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="6" cy="18" r="3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="18" cy="16" r="3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
