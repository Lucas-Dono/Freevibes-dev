import { NextRequest, NextResponse } from 'next/server';
import { getSpotify } from '@/lib/spotify';
import { cookies } from 'next/headers';

// Marcar esta ruta como dinámica para evitar errores de compilación estática
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log("API: Iniciando solicitud para obtener géneros del usuario");
    const sp = await getSpotify();
    const { searchParams } = new URL(request.url);

    // Parámetros
    const limit = parseInt(searchParams.get('limit') || '50');
    const timeRange = searchParams.get('timeRange') || 'medium_term'; // short_term, medium_term, long_term
    
    // Objeto donde almacenaremos los resultados
    let result: any = {
      success: false,
      message: "",
      topGenres: [],
      allGenres: {},
      topArtists: [],
      source: "", // Indicar la fuente de datos usada para los géneros
      hasUserInput: false // Indicar si requiere entrada manual del usuario
    };
    
    // Método 1: Artistas más escuchados
    try {
      console.log(`API: Obteniendo top artists para extraer géneros (limit=${limit}, timeRange=${timeRange})`);
      
      const topArtistsResponse = await sp.getMyTopArtists({ 
        limit: limit > 50 ? 50 : limit,
        time_range: timeRange as 'short_term' | 'medium_term' | 'long_term'
      });
      
      if (topArtistsResponse.items && topArtistsResponse.items.length > 0) {
        // Extraer géneros y contar frecuencia
        result = processArtistsGenres(topArtistsResponse.items, "artistas más escuchados");
        console.log(`API: Géneros extraídos correctamente de top artists. Total de géneros: ${Object.keys(result.allGenres).length}`);
        return NextResponse.json(result);
      } else {
        console.log("API: No se encontraron artistas top para extraer géneros, intentando con artistas seguidos");
      }
    } catch (error) {
      console.error("API: Error al obtener géneros de artistas top:", error);
      console.log("API: Intentando con artistas seguidos...");
    }
    
    // Método 2: Artistas seguidos
    try {
      console.log("API: Obteniendo artistas seguidos para extraer géneros");
      
      // Spotify devuelve artistas seguidos en formato paginado
      let followedArtists: any[] = [];
      let after: string | null = null;
      let hasMore = true;
      
      // Obtener el token de acceso directamente de las cookies
      const cookieStore = cookies();
      const spotifyToken = cookieStore.get('spotify_access_token')?.value;
      
      if (!spotifyToken) {
        console.error("API: No se encontró el token de Spotify en las cookies");
        throw new Error("Token de Spotify no disponible");
      }
      
      // Recuperar todos los artistas seguidos con paginación usando fetch directamente
      // ya que la biblioteca no proporciona getFollowedArtists
      while (hasMore) {
        const endpoint: string = `/me/following?type=artist&limit=50${after ? `&after=${after}` : ''}`;
        const url: string = `https://api.spotify.com/v1${endpoint}`;
        
        console.log(`[Fetch] Llamando a Spotify URL: ${url}`);
        const startTime = Date.now();
        
        const response: Response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${spotifyToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        const elapsedTime = Date.now() - startTime;
        console.log(`[Fetch] Tiempo de respuesta: ${elapsedTime}ms para ${endpoint}`);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: "No se pudo leer la respuesta de error" }));
          console.error(`[Fetch] Error (${response.status}) en Spotify API:`, errorData);
          throw new Error(`Error en Spotify API: ${response.status} ${JSON.stringify(errorData)}`);
        }
        
        console.log(`[Fetch] Respuesta exitosa para /me/following`);
        const data: any = await response.json();
        
        if (data && data.artists && data.artists.items && data.artists.items.length > 0) {
          followedArtists = [...followedArtists, ...data.artists.items];
          
          // Verificar si hay más artistas para recuperar
          after = data.artists.cursors.after;
          hasMore = !!after;
        } else {
          hasMore = false;
        }
      }
      
      console.log(`API: Se encontraron ${followedArtists.length} artistas seguidos`);
      
      if (followedArtists.length > 0) {
        // Extraer géneros y contar frecuencia
        result = processArtistsGenres(followedArtists, "artistas seguidos");
        console.log(`API: Géneros extraídos correctamente de artistas seguidos. Total de géneros: ${Object.keys(result.allGenres).length}`);
        return NextResponse.json(result);
      } else {
        console.log("API: No se encontraron artistas seguidos para extraer géneros");
        
        // Si no hay artistas seguidos, indicar que necesitamos entrada del usuario
        result = {
          success: true,
          message: "Se requiere selección manual de géneros",
          topGenres: [],
          allGenres: {},
          topArtists: [],
          source: "ninguno",
          hasUserInput: true // Indicar que requerimos entrada del usuario
        };
        
        return NextResponse.json(result);
      }
    } catch (followedError) {
      console.error("API: Error al obtener artistas seguidos:", followedError);
      
      // Si todo falla, indicar que necesitamos entrada del usuario
      result = {
        success: true,
        message: "Se requiere selección manual de géneros",
        topGenres: [],
        allGenres: {},
        topArtists: [],
        source: "ninguno",
        hasUserInput: true
      };
      
      return NextResponse.json(result);
    }
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error al obtener géneros del usuario',
        details: (error as Error).message,
        hasUserInput: true
      }, 
      { status: 500 }
    );
  }
}

/**
 * Procesa un array de artistas para extraer y contar sus géneros
 */
function processArtistsGenres(artists: any[], source: string) {
  // Objeto para contar la frecuencia de géneros
  const genreCounts: Record<string, number> = {};
  
  // Extraer géneros de los artistas
  artists.forEach((artist: any) => {
    if (artist.genres && artist.genres.length > 0) {
      artist.genres.forEach((genre: string) => {
        if (!genreCounts[genre]) {
          genreCounts[genre] = 0;
        }
        genreCounts[genre] += 1;
      });
    }
  });
  
  // Ordenar géneros por frecuencia
  const sortedGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({
      name,
      count,
      percentage: Math.round((count / artists.length) * 100)
    }));
  
  // Guardar datos en el resultado
  return {
    success: true,
    message: `Géneros obtenidos correctamente de ${source}`,
    topGenres: sortedGenres.slice(0, 20), // Top 20 géneros
    allGenres: genreCounts,
    topArtists: artists.slice(0, 10).map((artist: any) => ({
      id: artist.id,
      name: artist.name,
      genres: artist.genres,
      images: artist.images,
      popularity: artist.popularity
    })),
    source: source,
    hasUserInput: false
  };
} 