import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getRecommendationsByUserGenres } from '@/services/recommendations/sources/youtube-music';
import * as userGenreService from '@/services/user/genres';

export async function GET(request: Request) {
  try {
    // Verificar si estamos en modo demo
    const cookieStore = cookies();
    const isDemoMode = cookieStore.get('demo-mode')?.value === 'true' || 
                       cookieStore.get('demoMode')?.value === 'true';
    
    // Verificar en las cabeceras si viene de un cliente (por si las cookies no están disponibles)
    const demoHeader = request.headers.get('x-demo-mode') === 'true';
    
    if (isDemoMode || demoHeader) {
      console.log('[API] Solicitud de recomendaciones en modo demo');
      
      // En modo demo, usar géneros por defecto variados
      const demoGenres = ['pop', 'rock', 'latin', 'electronic', 'hip-hop'];
      
      // Obtener recomendaciones basadas en géneros demo
      const recommendations = await getRecommendationsByUserGenres(demoGenres);
      return NextResponse.json(recommendations);
    }
    
    // Obtener el token de Spotify de las cookies solo si no estamos en modo demo
    const spotifyToken = cookieStore.get('spotify_access_token')?.value;
    
    if (!spotifyToken) {
      return NextResponse.json({ error: 'Usuario no autenticado en Spotify' }, { status: 401 });
    }
    
    // Obtener el ID de Spotify del usuario
    const spotifyUserId = cookieStore.get('spotify_user_id')?.value;
    
    if (!spotifyUserId) {
      // Si no tenemos un ID de usuario explícito, podemos usar algunos géneros por defecto
      // o obtener géneros populares para proporcionar una experiencia básica
      console.log('No se encontró ID de usuario de Spotify, usando géneros por defecto');
      const defaultGenres = ['pop', 'rock', 'electronic'];
      
      // Obtener recomendaciones basadas en géneros por defecto
      const recommendations = await getRecommendationsByUserGenres(defaultGenres);
      return NextResponse.json(recommendations);
    }
    
    // Si tenemos ID de usuario, obtener sus géneros
    const userGenres = await userGenreService.getUserGenres(spotifyUserId);
    
    // Verificar si tenemos géneros para el usuario
    if (!userGenres || !userGenres.length) {
      console.log('No se encontraron géneros para el usuario, usando géneros por defecto');
      const defaultGenres = ['pop', 'rock', 'electronic'];
      
      // Obtener recomendaciones basadas en géneros por defecto
      const recommendations = await getRecommendationsByUserGenres(defaultGenres);
      return NextResponse.json(recommendations);
    }
    
    // Obtener recomendaciones basadas en los géneros del usuario
    const recommendations = await getRecommendationsByUserGenres(userGenres);
    
    return NextResponse.json(recommendations);
  } catch (error) {
    console.error('Error al obtener recomendaciones por géneros del usuario:', error);
    return NextResponse.json(
      { error: 'Error al obtener recomendaciones personalizadas' }, 
      { status: 500 }
    );
  }
} 