import { NextRequest, NextResponse } from 'next/server';
import { getSpotify } from '@/lib/spotify';
import axios from 'axios';

// Interfaces para tipar las respuestas
interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string; id: string }>;
  album: {
    name: string;
    images: Array<{ url: string; width: number; height: number }>;
  };
  duration_ms: number;
}

// URL del servidor Node que actúa como intermediario
const NODE_SERVER_URL = process.env.NODE_SERVER_URL || 'http://localhost:3001/api';

// API Key de YouTube oficial
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3';

// Función para buscar directamente en YouTube usando la API oficial
async function searchYouTubeOfficial(songName: string, artistName: string) {
  try {
    console.log(`Buscando en API oficial de YouTube: "${songName}" de "${artistName}"`);
    
    if (!YOUTUBE_API_KEY) {
      throw new Error('API key de YouTube no configurada');
    }
    
    // Preparar la consulta
    const query = `${songName} ${artistName} official audio`;
    
    // Realizar la búsqueda
    const response = await axios.get(`${YOUTUBE_API_URL}/search`, {
      params: {
        key: YOUTUBE_API_KEY,
        q: query,
        part: 'snippet',
        maxResults: 3,
        type: 'video',
        videoCategoryId: '10', // Categoría de música
        videoEmbeddable: 'true' // Solo videos que se pueden embeber
      },
      timeout: 5000
    });
    
    // Verificar resultados
    if (response.data && response.data.items && response.data.items.length > 0) {
      // Filtrar resultados para evitar tutoriales, covers, etc.
      const filteredItems = response.data.items.filter((item: any) => 
        !item.snippet.title.toLowerCase().includes('tutorial') &&
        !item.snippet.title.toLowerCase().includes('gameplay') &&
        !item.snippet.title.toLowerCase().includes('cover') &&
        item.snippet.thumbnails.high?.url
      );
      
      // Usar el primer resultado filtrado o el primero original si no hay filtrados
      const bestMatch = filteredItems.length > 0 ? filteredItems[0] : response.data.items[0];
      
      console.log(`Video encontrado con API oficial: ${bestMatch.snippet.title} (ID: ${bestMatch.id.videoId})`);
      
      // Obtener más detalles del video
      const detailsResponse = await axios.get(`${YOUTUBE_API_URL}/videos`, {
        params: {
          key: YOUTUBE_API_KEY,
          id: bestMatch.id.videoId,
          part: 'snippet,contentDetails'
        },
        timeout: 5000
      });
      
      const videoDetails = detailsResponse.data.items[0];
      
      return {
        videoId: bestMatch.id.videoId,
        title: songName,
        artist: artistName,
        videoTitle: bestMatch.snippet.title,
        thumbnail: bestMatch.snippet.thumbnails.high?.url || bestMatch.snippet.thumbnails.default?.url,
        // Formato ISO 8601 para duración, podríamos convertirlo si es necesario
        duration: videoDetails?.contentDetails?.duration ? 
                  convertISO8601ToSeconds(videoDetails.contentDetails.duration) : 0
      };
    }
    
    throw new Error('No se encontraron videos');
  } catch (error) {
    console.error('Error en búsqueda con API oficial de YouTube:', error);
    throw error;
  }
}

// Función para convertir duración ISO 8601 a segundos
function convertISO8601ToSeconds(duration: string): number {
  const matches = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!matches) return 0;
  
  const hours = parseInt(matches[1] || '0', 10);
  const minutes = parseInt(matches[2] || '0', 10);
  const seconds = parseInt(matches[3] || '0', 10);
  
  return hours * 3600 + minutes * 60 + seconds;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('[API] Solicitud recibida para reproducción:', body);
    
    // Extraer datos con múltiples formas posibles
    const { trackId, name, artist, title, artists } = body;

    // Validar que hay suficiente información para la búsqueda
    if (!trackId && (!name && !title) && (!artist && !artists)) {
      console.error('[API] Datos insuficientes para la búsqueda:', body);
      return NextResponse.json(
        { error: 'Se requiere un ID de pista o al menos título y artista' },
        { status: 400 }
      );
    }

    // Extraer ID de Spotify si existe
    // Verificar si el trackId es un URI de Spotify y extraer solo el ID
    const spotifyId = trackId ? (trackId.includes(':') 
      ? trackId.split(':').pop() 
      : trackId) : '';

    console.log(`[API] Procesando solicitud de reproducción para track: ${spotifyId || 'sin-id'}`);

    // Determinar el nombre de la canción y artista con varios fallbacks
    let songName = name || title || '';
    let artistName = artist || (Array.isArray(artists) ? artists.map((a: any) => typeof a === 'string' ? a : a.name).join(', ') : '') || '';

    // Si no tenemos nombre o artista, intentamos obtenerlos de Spotify
    if ((!songName || !artistName) && spotifyId) {
      try {
        console.log('[API] Buscando información adicional desde Spotify para:', spotifyId);
        // Obtener los detalles de la pista desde Spotify
        const sp = await getSpotify();
        const trackDetails = await sp.getTrack(spotifyId) as SpotifyTrack;

        // Extraer nombre de la canción y artista
        songName = songName || trackDetails.name;
        artistName = artistName || trackDetails.artists[0].name;
        
        console.log('[API] Información obtenida de Spotify:', { songName, artistName });
      } catch (error) {
        console.error('[API] Error al obtener detalles desde Spotify:', error);
        if (!songName) songName = 'Canción desconocida';
        if (!artistName) artistName = 'Artista desconocido';
      }
    }

    console.log(`[API] Buscando video para: "${songName}" de "${artistName}"`);

    // PRIMERA ESTRATEGIA: Intentar con la API oficial de YouTube
    try {
      console.log(`[API] Intentando primero con API oficial de YouTube para mejor rendimiento`);
      const youtubeResult = await searchYouTubeOfficial(songName, artistName);
      
      console.log(`[API] Búsqueda exitosa con API oficial de YouTube: ${youtubeResult.videoTitle}`);
      
      return NextResponse.json({
        videoId: youtubeResult.videoId,
        title: songName,
        artist: artistName,
        spotifyId,
        videoTitle: youtubeResult.videoTitle,
        thumbnail: youtubeResult.thumbnail,
        duration: youtubeResult.duration || 0
      });
    } catch (youtubeError) {
      console.error('[API] API oficial de YouTube falló:', youtubeError);
      console.log('[API] Intentando con servidores alternativos...');
      
      // Si falla la API oficial, intentar con el servidor Node
      try {
        return await fallbackSearchNode(songName, artistName, spotifyId);
      } catch (fallbackError) {
        console.error('[API] Todos los métodos de búsqueda fallaron:', fallbackError);
        
        // Intentar con una búsqueda más simple como última opción
        try {
          console.log('[API] Último intento: búsqueda general simple');
          
          // Construir una consulta simplificada
          const simpleQuery = `${songName} ${artistName} official audio`;
          
          // Realizar una búsqueda más básica
          const simpleSearchResponse = await fetch(`${NODE_SERVER_URL}/youtube/search?query=${encodeURIComponent(simpleQuery)}&limit=1`, {
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'MusicPlayer/1.0'
            },
            cache: 'no-store'
          });
          
          if (!simpleSearchResponse.ok) {
            throw new Error(`Error en búsqueda simple: ${simpleSearchResponse.status}`);
          }
          
          const simpleData = await simpleSearchResponse.json();
          
          if (simpleData && simpleData.results && simpleData.results.length > 0) {
            const firstResult = simpleData.results[0];
            console.log(`[API] Búsqueda simple exitosa: ${firstResult.title}`);
            
            return NextResponse.json({
              videoId: firstResult.videoId,
              title: songName,
              artist: artistName,
              spotifyId,
              videoTitle: firstResult.title,
              thumbnail: firstResult.thumbnails?.[0]?.url || '',
              duration: firstResult.duration || 0
            });
          }
          
          throw new Error('No se encontraron resultados');
        } catch (simpleSearchError) {
          console.error('[API] Búsqueda simple también falló:', simpleSearchError);
          
          // Devolver un error claro
          return NextResponse.json(
            { 
              error: 'No se pudo encontrar un video para esta canción', 
              details: 'Todos los métodos de búsqueda fallaron',
              trackInfo: { songName, artistName }
            },
            { status: 404 }
          );
        }
      }
    }
  } catch (error) {
    console.error('[API] Error al procesar solicitud de reproducción:', error);
    
    // Retornar un error claro
    return NextResponse.json(
      { error: 'Error al procesar la solicitud', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// Función para búsqueda con el servidor Node cuando falla la API oficial
async function fallbackSearchNode(songName: string, artistName: string, spotifyId: string) {
  try {
    console.log(`[API] Buscando en servidor Node para: "${songName}" por "${artistName}"`);
    
    // Primero intentar con find-track que es más preciso
    try {
      console.log(`[API] Intentando con find-track (búsqueda precisa)`);
      const response = await fetch(`${NODE_SERVER_URL}/youtube/find-track?title=${encodeURIComponent(songName)}&artist=${encodeURIComponent(artistName)}`, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'MusicPlayer/1.0'
        },
        cache: 'no-store'
      });
      
      if (!response.ok) {
        console.error(`[API] Error en find-track: ${response.status}`);
        throw new Error(`Error en la búsqueda: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Si tenemos un videoId, devolver la información
      if (data && data.videoId) {
        console.log(`[API] Video encontrado con find-track: ${data.title} (ID: ${data.videoId})`);
        
        return NextResponse.json({
          videoId: data.videoId,
          title: songName,
          artist: artistName,
          spotifyId,
          videoTitle: data.title,
          thumbnail: data.videoThumbnails?.[0]?.url || '',
          duration: data.lengthSeconds || 0
        });
      } else {
        console.log(`[API] find-track no encontró video, probando búsqueda general`);
        throw new Error('No se encontró video específico');
      }
    } catch (findTrackError: unknown) {
      const errorMessage = findTrackError instanceof Error 
        ? findTrackError.message 
        : 'Error desconocido en find-track';
      
      console.log(`[API] Error en find-track, intentando búsqueda general: ${errorMessage}`);
      
      // Si falla find-track, intentar con búsqueda general
      try {
        console.log(`[API] Intentando búsqueda general`);
        const query = `${songName} ${artistName}`;
        const response = await fetch(`${NODE_SERVER_URL}/youtube/search?query=${encodeURIComponent(query)}&filter=songs&limit=1`, {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'MusicPlayer/1.0'
          },
          cache: 'no-store'
        });
        
        if (!response.ok) {
          console.error(`[API] Error en búsqueda general: ${response.status}`);
          throw new Error(`Error en búsqueda general: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data && data.results && data.results.length > 0) {
          const firstResult = data.results[0];
          console.log(`[API] Búsqueda general exitosa: ${firstResult.title}`);
          
          return NextResponse.json({
            videoId: firstResult.videoId,
            title: songName,
            artist: artistName,
            spotifyId,
            videoTitle: firstResult.title,
            thumbnail: firstResult.thumbnails?.[0]?.url || '',
            duration: firstResult.duration || 0
          });
        }
        
        console.error('[API] Búsqueda general no encontró resultados');
        throw new Error('No se encontraron videos');
      } catch (generalSearchError) {
        console.error('[API] Error en búsqueda general:', generalSearchError);
        throw generalSearchError;
      }
    }
  } catch (error) {
    console.error(`[API] Error buscando video para "${songName}" de "${artistName}":`, error);
    throw error;
  }
} 