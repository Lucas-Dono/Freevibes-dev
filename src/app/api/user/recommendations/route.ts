import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getRecommendationsByUserGenres } from '@/services/recommendations/sources/youtube-music';
import * as userGenreService from '@/services/user/genres';
import { getAPIConfig } from '@/lib/api-config';

export async function GET(request: Request) {
  try {
    console.log('[API] Iniciando solicitud de recomendaciones');
    const { searchParams } = new URL(request.url);
    
    // Obtener parámetros de la URL - permitir ambos formatos
    const seed_artist = searchParams.get('seed_artist') || '';
    const seed_track = searchParams.get('seed_track') || '';
    const limitParam = searchParams.get('limit') || '25';
    const limit = parseInt(limitParam, 10) || 25;
    
    console.log(`[API] Parámetros: seed_artist="${seed_artist}", seed_track="${seed_track}", limit=${limit}`);
    
    // Verificar si estamos en modo demo
    const cookieStore = cookies();
    const isDemoMode = cookieStore.get('demo-mode')?.value === 'true' ||
                       cookieStore.get('demoMode')?.value === 'true';

    // Verificar en las cabeceras si viene de un cliente
    const demoHeader = request.headers.get('x-demo-mode') === 'true';

    // Si tenemos una semilla de canción/artista específica, usar el endpoint directo de recomendaciones
    if (seed_track || seed_artist) {
      console.log(`[API] Usando endpoint directo de recomendaciones con semillas`);
      
      try {
        // Preparar parámetros para la solicitud
        const params = new URLSearchParams();
        if (seed_artist) params.append('seed_artist', seed_artist);
        if (seed_track) params.append('seed_track', seed_track);
        params.append('limit', limitParam);
        
        // Obtener la URL de la API de Python
        const apiConfig = getAPIConfig();
        // Construir la URL para las recomendaciones (usar API de Python)
        const pythonApiUrl = apiConfig.pythonApiUrl || '';
        const recommendationsUrl = `${pythonApiUrl}/api/recommendations?${params.toString()}`;
        
        console.log(`[API] Solicitando recomendaciones a: ${recommendationsUrl}`);
        
        // Realizar la solicitud con un timeout de 10 segundos
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(recommendationsUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-demo-mode': isDemoMode || demoHeader ? 'true' : 'false'
          },
          signal: controller.signal
        });
        
        // Limpiar el timeout
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`Error en la respuesta: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`[API] Recomendaciones recibidas: ${Array.isArray(data) ? data.length : 'no es un array'}`);
        
        // Asegurarnos de devolver siempre un array
        const recommendations = Array.isArray(data) ? data : [];
        
        // Verificar si tenemos suficientes recomendaciones
        if (recommendations.length === 0) {
          console.warn('[API] No se recibieron recomendaciones, generando fallback');
          const fallbackTracks = generateFallbackTracks(seed_artist, seed_track, limit);
          return NextResponse.json(fallbackTracks);
        }
        
        // Devolver las recomendaciones como un array plano
        return NextResponse.json(recommendations);
      } catch (error) {
        console.error(`[API] Error al obtener recomendaciones con semillas:`, error);
        // Si hay error, devolver tracks de fallback
        const fallbackTracks = generateFallbackTracks(seed_artist, seed_track, limit);
        return NextResponse.json(fallbackTracks);
      }
    }
    
    // Si no hay semillas específicas, continuar con la lógica existente basada en géneros
    if (isDemoMode || demoHeader) {
      console.log('[API] Solicitud de recomendaciones en modo demo basada en géneros');

      // En modo demo, usar géneros por defecto variados
      const demoGenres = ['pop', 'rock', 'latin', 'electronic', 'hip-hop'];

      // Obtener recomendaciones basadas en géneros demo
      const recommendations = await getRecommendationsByUserGenres(demoGenres);
      // Extraer solo los tracks de la respuesta
      return NextResponse.json(recommendations.tracks || []);
    }

    // Obtener el token de Spotify de las cookies solo si no estamos en modo demo
    const spotifyToken = cookieStore.get('spotify_access_token')?.value;

    if (!spotifyToken) {
      console.warn('[API] Usuario no autenticado en Spotify, usando géneros por defecto');
      const defaultGenres = ['pop', 'rock', 'electronic'];
      const recommendations = await getRecommendationsByUserGenres(defaultGenres);
      return NextResponse.json(recommendations.tracks || []);
    }

    // Obtener el ID de Spotify del usuario
    const spotifyUserId = cookieStore.get('spotify_user_id')?.value;

    if (!spotifyUserId) {
      console.log('[API] No se encontró ID de usuario de Spotify, usando géneros por defecto');
      const defaultGenres = ['pop', 'rock', 'electronic'];
      const recommendations = await getRecommendationsByUserGenres(defaultGenres);
      return NextResponse.json(recommendations.tracks || []);
    }

    // Si tenemos ID de usuario, obtener sus géneros
    const userGenres = await userGenreService.getUserGenres(spotifyUserId);

    // Verificar si tenemos géneros para el usuario
    if (!userGenres || !userGenres.length) {
      console.log('[API] No se encontraron géneros para el usuario, usando géneros por defecto');
      const defaultGenres = ['pop', 'rock', 'electronic'];
      const recommendations = await getRecommendationsByUserGenres(defaultGenres);
      return NextResponse.json(recommendations.tracks || []);
    }

    // Obtener recomendaciones basadas en los géneros del usuario
    const recommendations = await getRecommendationsByUserGenres(userGenres);

    // Devolver solo los tracks (para mantener compatibilidad con el formato esperado)
    return NextResponse.json(recommendations.tracks || []);
  } catch (error) {
    console.error('[API] Error al obtener recomendaciones:', error);
    // Devolver un array vacío en caso de error para evitar errores en el cliente
    return NextResponse.json([]);
  }
}

// Función auxiliar para generar tracks de fallback cuando todo falla
function generateFallbackTracks(seedArtist: string, seedTrack: string, limit: number): any[] {
  console.log(`[API] Generando ${limit} tracks fallback para: ${seedTrack} - ${seedArtist}`);
  
  const fallbackTracks = [];
  const artistBase = seedArtist || 'Artista';
  const similarArtists = [
    `Similar a ${artistBase}`, 
    'Artista Popular', 
    'Nueva Música', 
    'Top Hits', 
    'El mejor', 
    'Clásicos'
  ];
  
  for (let i = 0; i < limit; i++) {
    const artistIndex = i % similarArtists.length;
    fallbackTracks.push({
      id: `nextjs_fallback_${i}_${Date.now()}`,
      youtubeId: `fallback_${i}_${Date.now().toString().substring(7)}`,
      title: seedTrack ? `Similar a "${seedTrack}" #${i + 1}` : `Canción recomendada #${i + 1}`,
      artist: similarArtists[artistIndex],
      album: 'Álbum Recomendado',
      albumCover: '/placeholder-album.jpg',
      cover: '/placeholder-album.jpg',
      duration: 180 + (i * 20), // Duración en segundos
      source: 'nextjs-fallback'
    });
  }
  
  return fallbackTracks;
}
