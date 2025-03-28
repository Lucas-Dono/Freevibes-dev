import { NextRequest, NextResponse } from 'next/server';
import { getSpotify } from '@/lib/spotify';
import axios from 'axios';

// Interfaces para tipar las respuestas
interface YouTubeSearchResponse {
  items: Array<{
    id: {
      videoId: string;
    };
    snippet: {
      title: string;
      description: string;
      thumbnails: {
        default: { url: string; width: number; height: number };
        medium: { url: string; width: number; height: number };
        high: { url: string; width: number; height: number };
      };
      channelTitle: string;
    };
  }>;
  pageInfo: {
    totalResults: number;
    resultsPerPage: number;
  };
  nextPageToken?: string;
}

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

// Obtener la clave API de YouTube desde las variables de entorno
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { trackId, name, artist } = body;

    if (!trackId) {
      return NextResponse.json(
        { error: 'Se requiere un ID de pista' },
        { status: 400 }
      );
    }

    // Verificar si el trackId es un URI de Spotify y extraer solo el ID
    const spotifyId = trackId.includes(':') 
      ? trackId.split(':').pop() 
      : trackId;

    console.log(`Procesando solicitud de reproducción para track: ${spotifyId}`);

    // Si tenemos nombre y artista directamente del frontend, usamos esos
    let songName = name;
    let artistName = artist;

    // Si no tenemos nombre o artista, intentamos obtenerlos de Spotify
    if (!songName || !artistName) {
      try {
        // Obtener los detalles de la pista desde Spotify
        const sp = await getSpotify();
        const trackDetails = await sp.getTrack(spotifyId) as SpotifyTrack;

        // Extraer nombre de la canción y artista
        songName = trackDetails.name;
        artistName = trackDetails.artists[0].name;
      } catch (error) {
        console.error('Error al obtener detalles de la canción desde Spotify:', error);
        return NextResponse.json(
          { error: 'Error al obtener detalles de la canción', details: (error as Error).message },
          { status: 500 }
        );
      }
    }

    console.log(`Buscando video para: "${songName}" de "${artistName}"`);

    // Buscar el video en YouTube con formato "songName lyric artistName"
    const youtubeQuery = `${songName} lyric ${artistName}`;
    const encodedQuery = encodeURIComponent(youtubeQuery);
    
    // Llamar a la API de YouTube para buscar videos
    const youtubeResponse = await axios.get<YouTubeSearchResponse>(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodedQuery}&type=video&key=${YOUTUBE_API_KEY}&maxResults=1`
    );

    // Si no hay resultados, intentar búsqueda alternativa
    if (!youtubeResponse.data.items || youtubeResponse.data.items.length === 0) {
      console.log(`No se encontraron resultados para "${youtubeQuery}", intentando búsqueda alternativa`);
      
      // Búsqueda alternativa: "songName artistName audio"
      const alternativeQuery = `${songName} ${artistName} audio`;
      const encodedAlternativeQuery = encodeURIComponent(alternativeQuery);
      
      const alternativeResponse = await axios.get<YouTubeSearchResponse>(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodedAlternativeQuery}&type=video&key=${YOUTUBE_API_KEY}&maxResults=1`
      );
      
      if (!alternativeResponse.data.items || alternativeResponse.data.items.length === 0) {
        return NextResponse.json(
          { error: 'No se encontraron videos para esta canción' },
          { status: 404 }
        );
      }
      
      // Retornar el ID del video alternativo encontrado
      const videoId = alternativeResponse.data.items[0].id.videoId;
      const videoTitle = alternativeResponse.data.items[0].snippet.title;
      
      console.log(`Video alternativo encontrado: ${videoTitle} (ID: ${videoId})`);
      
      return NextResponse.json({
        videoId,
        title: songName,
        artist: artistName,
        spotifyId,
        videoTitle,
        thumbnail: alternativeResponse.data.items[0].snippet.thumbnails.high.url,
        duration: 0 // No tenemos esta información sin hacer otra llamada
      });
    }
    
    // Retornar el ID del video encontrado
    const videoId = youtubeResponse.data.items[0].id.videoId;
    const videoTitle = youtubeResponse.data.items[0].snippet.title;
    
    console.log(`Video encontrado: ${videoTitle} (ID: ${videoId})`);
    
    return NextResponse.json({
      videoId,
      title: songName,
      artist: artistName,
      spotifyId,
      videoTitle,
      thumbnail: youtubeResponse.data.items[0].snippet.thumbnails.high.url,
      duration: 0 // No tenemos esta información sin hacer otra llamada
    });
    
  } catch (error) {
    console.error('Error al procesar solicitud de reproducción:', error);
    return NextResponse.json(
      { error: 'Error al procesar la solicitud', details: (error as Error).message },
      { status: 500 }
    );
  }
} 