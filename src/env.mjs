// src/env.mjs - Archivo de configuración de variables de entorno
// Este archivo centraliza el acceso a las variables de entorno para evitar importaciones inconsistentes

export const env = {
  // URLs de servicios
  NODE_SERVER_URL: process.env.NEXT_PUBLIC_NODE_API_URL || 'http://localhost:3001',
  PYTHON_API_URL: process.env.NEXT_PUBLIC_PYTHON_API_URL || 'http://localhost:5000', // Reintroducida SOLO para check de status inicial
  
  // Configuración de la aplicación
  APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE === 'true',
  
  // APIs externas
  SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID || '',
  SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET || '',
  
  // Variables específicas
  ENABLE_LYRICS: process.env.NEXT_PUBLIC_ENABLE_LYRICS !== 'false',
  ENABLE_YOUTUBE_LYRICS: process.env.NEXT_PUBLIC_ENABLE_YOUTUBE_LYRICS !== 'false',
}; 