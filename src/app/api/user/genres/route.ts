import { NextRequest, NextResponse } from 'next/server';
import { getSpotify } from '@/lib/spotify';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Marcar esta ruta como dinámica para evitar errores de compilación estática
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log("API: Iniciando solicitud para obtener géneros del usuario");
    
    // Verificar si estamos en modo demo desde cookies o headers
    const cookieStore = cookies();
    const isDemoModeCookie = cookieStore.get('demo-mode')?.value === 'true' || 
                            cookieStore.get('demoMode')?.value === 'true';
    const isDemoModeHeader = request.headers.get('x-demo-mode') === 'true';
    const isDemoMode = isDemoModeCookie || isDemoModeHeader;
    
    if (isDemoMode) {
      console.log("API: Solicitud en modo demo, devolviendo géneros predefinidos");
      
      // Crear un conjunto de géneros predefinidos para el modo demo
      const demoGenres = {
        "pop": 15,
        "latin pop": 12,
        "dance pop": 10,
        "urban contemporary": 9,
        "reggaeton": 8,
        "latin urban": 7,
        "trap latino": 6,
        "tropical house": 5,
        "edm": 5,
        "r&b": 4,
        "hip hop": 4,
        "indie pop": 3,
        "rock": 3,
        "alternative rock": 2,
        "electronic": 2
      };
      
      // Crear top géneros en formato ordenado
      const topGenres = Object.entries(demoGenres)
        .map(([name, count]) => ({
          name,
          count,
          percentage: Math.round((count / 20) * 100)
        }))
        .sort((a, b) => b.count - a.count);
      
      // Devolver resultado estructurado para modo demo
      return NextResponse.json({
        success: true,
        message: "Géneros obtenidos correctamente en modo demo",
        topGenres: topGenres,
        allGenres: demoGenres,
        topArtists: [
          {
            id: "demo_artist_1",
            name: "Bad Bunny",
            genres: ["latin trap", "reggaeton", "trap latino"],
            images: [{ url: "https://i.scdn.co/image/ab6761610000e5eb3bcf152e4f2387414ef5248d" }],
            popularity: 98
          },
          {
            id: "demo_artist_2",
            name: "Dua Lipa",
            genres: ["dance pop", "pop", "uk pop"],
            images: [{ url: "https://i.scdn.co/image/ab6761610000e5eb54f401f09aeefe19d318a8b4" }],
            popularity: 95
          },
          {
            id: "demo_artist_3",
            name: "Taylor Swift",
            genres: ["pop", "dance pop"],
            images: [{ url: "https://i.scdn.co/image/ab6761610000e5eb5a00969a4698c3bc19d84156" }],
            popularity: 99
          }
        ],
        source: "modo demo",
        hasUserInput: false
      });
    }
    
    // Obtener la sesión del servidor para acceso al token (solo si no estamos en modo demo)
    const session = await getServerSession(authOptions);
    
    if (!session || !session.accessToken) {
      console.error("API: No hay sesión de usuario o token de acceso");
      return NextResponse.json(
        {
          success: false,
          error: 'Usuario no autenticado',
          hasUserInput: true
        }, 
        { status: 401 }
      );
    }
    
    const sp = await getSpotify(session.accessToken);
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