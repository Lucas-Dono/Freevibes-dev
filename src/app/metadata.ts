import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FreeVibes - Reproductor de Música',
  description: 'Descubre y reproduce música de YouTube y Spotify en un solo lugar.',
  keywords: ['música', 'reproductor', 'YouTube', 'Spotify', 'streaming'],
  authors: [{ name: 'FreeVibes Team' }],
  openGraph: {
    title: 'FreeVibes - Reproductor de Música',
    description: 'Descubre y reproduce música de YouTube y Spotify en un solo lugar.',
    url: 'https://freevibes.app',
    siteName: 'FreeVibes',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'FreeVibes - Reproductor de Música',
      },
    ],
    locale: 'es_ES',
    type: 'website',
  },
}; 