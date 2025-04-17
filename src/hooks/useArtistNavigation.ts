import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import axios from 'axios';
import { searchYouTubeArtist } from '@/services/youtube/youtube-api';

// Interfaz para el objeto de artista
interface Artist {
  browseId?: string;
  id?: string;
  title?: string;
  name?: string;
  thumbnails?: any[];
  thumbnail?: string;
  [key: string]: any; // Para campos adicionales que puedan estar presentes
}

export function useArtistNavigation() {
  const router = useRouter();
  const { isDemo } = useAuth();

  /**
   * Convierte un ID de Spotify a un ID de YouTube Music
   * @param spotifyId ID de Spotify para convertir
   * @param artistName Nombre del artista para búsqueda
   * @returns Información del artista encontrado en YouTube Music o null si no se encuentra
   */
  const convertSpotifyToYouTubeArtist = async (
    spotifyId: string,
    artistName: string
  ): Promise<{success: boolean, artist?: Artist, error?: string}> => {
    if (!artistName || artistName.trim() === '') {
      console.error(`[ArtistNavigation] No se puede convertir sin nombre de artista, ID: ${spotifyId}`);
      return { 
        success: false, 
        error: 'Se requiere el nombre del artista para convertir IDs' 
      };
    }

    try {
      console.log(`[ArtistNavigation] Convirtiendo ID de Spotify a YouTube Music: ${spotifyId} (${artistName})`);
      
      // Buscar artista en YouTube Music usando el nombre
      const result = await findArtistByName(artistName);
      
      if (result.success && result.artist?.browseId) {
        console.log(`[ArtistNavigation] Convertido exitosamente: ${spotifyId} → ${result.artist.browseId}`);
        return {
          success: true,
          artist: result.artist
        };
      } else {
        console.warn(`[ArtistNavigation] No se pudo convertir ID: ${spotifyId}`, result.error);
        return {
          success: false,
          error: result.error || 'No se encontró artista equivalente en YouTube Music'
        };
      }
    } catch (error) {
      console.error(`[ArtistNavigation] Error al convertir ID: ${spotifyId}`, error);
      return {
        success: false,
        error: `Error en conversión: ${(error as Error).message}`
      };
    }
  };

  /**
   * Navega a la página de un artista, manejando automáticamente los IDs de Spotify en modo demo
   * @param artistId ID del artista (Spotify o YouTube Music)
   * @param artistName Nombre del artista para búsqueda alternativa
   * @param options Opciones adicionales (redirigirABusqueda, mostrarDetalles)
   */
  const navigateToArtist = async (
    artistId: string, 
    artistName: string, 
    options: { 
      redirigirABusqueda?: boolean,
      mostrarDetalles?: boolean,
      usarNavegacionDirecta?: boolean,
      urlFallback?: string
    } = {}
  ) => {
    console.log(`[ArtistNavigation] Iniciando navegación para artista id=${artistId}, name=${artistName}`);
    console.log(`[ArtistNavigation] Opciones:`, options);
    console.log(`[ArtistNavigation] Modo demo: ${isDemo ? 'activado' : 'desactivado'}`);
    
    // Si no hay un nombre de artista proporcionado, usar el ID como nombre
    if (!artistName || artistName.trim() === '') {
      console.log(`[ArtistNavigation] Nombre de artista no proporcionado, usando ID como nombre`);
      artistName = artistId;
    }
    
    // URL de fallback (donde ir si falla todo)
    const fallbackUrl = options.urlFallback || "/search";
    
    // Método de navegación (directa con window.location o usando router)
    const navigateTo = (url: string) => {
      try {
        if (options.usarNavegacionDirecta) {
          console.log(`[ArtistNavigation] Usando navegación directa a: ${url}`);
          window.location.href = url;
        } else {
          console.log(`[ArtistNavigation] Usando router.push a: ${url}`);
          router.push(url);
        }
      } catch (error) {
        console.error(`[ArtistNavigation] Error durante la navegación:`, error);
        // Último recurso: usar window.location siempre
        window.location.href = url;
      }
    };
    
    // Si no estamos en modo demo o el ID ya es de YouTube Music (comienza con UC), navegar normalmente
    if (!isDemo || artistId.startsWith('UC')) {
      console.log(`[ArtistNavigation] Navegación directa a /artist/${artistId}`);
      navigateTo(`/artist/${artistId}`);
      return { success: true, id: artistId, source: 'direct' };
    }

    // Reconocer explícitamente IDs de Spotify
    const isSpotifyId = artistId.startsWith('spotify:') || 
                       (artistId.length === 22 && /^[a-zA-Z0-9]+$/.test(artistId));
    
    if (isSpotifyId) {
      console.log(`[ArtistNavigation] Detectado ID de Spotify en modo demo: ${artistId}`);
      // Ya no intentamos convertir automáticamente en modo demo
      // console.log(`[ArtistNavigation] Intentando convertir automáticamente a ID de YouTube Music`);
      
      /* // ---- INICIO BLOQUE COMENTADO ----
      try {
        // Intentar convertir ID de Spotify a YouTube Music
        const conversionResult = await convertSpotifyToYouTubeArtist(artistId, artistName);
        
        if (conversionResult.success && conversionResult.artist?.browseId) {
          const youtubeArtistId = conversionResult.artist.browseId;
          console.log(`[ArtistNavigation] Conversión exitosa: ${artistId} → ${youtubeArtistId}`);
          
          // Navegar al artista con el ID de YouTube Music
          const artistUrl = `/artist/${youtubeArtistId}`;
          console.log(`[ArtistNavigation] Navegando a: ${artistUrl}`);
          
          navigateTo(artistUrl);
          return { 
            success: true, 
            id: youtubeArtistId, 
            originalId: artistId,
            source: 'converted',
            artist: conversionResult.artist 
          };
        } else {
          console.warn(`[ArtistNavigation] Conversión fallida, continuando con búsqueda manual`);
        }
      } catch (error) {
        console.error(`[ArtistNavigation] Error en conversión de ID:`, error);
      }
      */ // ---- FIN BLOQUE COMENTADO ----

      // Si es un ID de Spotify (en modo demo o no), simplemente navegar a la página de artista con ese ID
      console.log(`[ArtistNavigation] Navegando directamente a la página de artista con ID de Spotify: ${artistId}`);
      navigateTo(`/artist/${artistId}`);
      return { success: true, id: artistId, source: 'direct_spotify' };

    }

    // En modo demo con ID que no es de YouTube Music Y NO ES DE SPOTIFY (caso raro), buscar el artista por nombre
    try {
      console.log(`[ArtistNavigation] Buscando artista "${artistName}" en YouTube Music`);
      
      // Intenta obtener artistas con un límite mayor para tener más probabilidades de éxito
      const response = await axios.get('/api/youtube/search', {
        params: {
          query: artistName,
          filter: 'artists',
          limit: 5 // Aumentar el límite para más opciones
        },
        timeout: 15000 // 15 segundos de timeout
      });
      
      console.log(`[ArtistNavigation] Respuesta de búsqueda recibida. Tipo:`, 
        Array.isArray(response.data) ? 'Array' : typeof response.data);
      
      // Si la respuesta es un objeto con propiedad "results", usar eso
      let artists = [];
      if (response.data && Array.isArray(response.data)) {
        artists = response.data;
      } else if (response.data && Array.isArray(response.data.results)) {
        artists = response.data.results;
      } else {
        console.warn(`[ArtistNavigation] Formato de respuesta inesperado:`, response.data);
        artists = [];
      }
      
      console.log(`[ArtistNavigation] Número de resultados:`, artists.length);
      
      if (artists.length > 0) {
        // Primero, intentar encontrar una coincidencia exacta por nombre
        let validArtist: Artist | undefined = artists.find((artist: Artist) => 
          (artist.title || artist.name || '').toLowerCase() === artistName.toLowerCase() && artist.browseId
        );
        
        // Si no hay coincidencia exacta, usar el primer artista con browseId
        if (!validArtist) {
          validArtist = artists.find((artist: Artist) => artist.browseId);
        }
        
        if (validArtist) {
          console.log(`[ArtistNavigation] Artista válido encontrado:`, validArtist);
          
          if (validArtist.browseId) {
            console.log(`[ArtistNavigation] Artista con browseId: ${validArtist.browseId}`);
            
            // Si la opción mostrarDetalles está habilitada, mostrar más información
            if (options.mostrarDetalles) {
              console.log(`[ArtistNavigation] Detalles del artista:`, validArtist);
            }
            
            // Construir URL del artista
            const artistUrl = `/artist/${validArtist.browseId}`;
            console.log(`[ArtistNavigation] Navegando a: ${artistUrl}`);
            
            // Siempre usar window.location.href para estos casos críticos
            if (options.usarNavegacionDirecta !== false) {
              window.location.href = artistUrl;
            } else {
              navigateTo(artistUrl);
            }
            
            return { 
              success: true, 
              id: validArtist.browseId, 
              source: 'youtube_music',
              artist: validArtist 
            };
          } else {
            console.warn(`[ArtistNavigation] Artista sin browseId válido:`, validArtist);
          }
        } else {
          console.warn(`[ArtistNavigation] No se encontró artista con browseId en los resultados:`, artists);
        }
      } else {
        console.warn(`[ArtistNavigation] No se encontraron resultados para "${artistName}" en YouTube Music, intentando con YouTube API directa...`);
        
        // Intentar buscar con el nuevo endpoint de búsqueda directa de YouTube
        try {
          const youtubeSearchResponse = await axios.get('/api/youtube/search-channels', {
            params: { query: artistName },
            timeout: 15000
          });
          
          if (youtubeSearchResponse.data && 
              youtubeSearchResponse.data.results && 
              youtubeSearchResponse.data.results.length > 0) {
            
            const youtubeChannels = youtubeSearchResponse.data.results;
            console.log(`[ArtistNavigation] Encontrados ${youtubeChannels.length} canales de YouTube para "${artistName}"`);
            
            // Buscar coincidencia exacta primero
            let validChannel = youtubeChannels.find((channel: any) => 
              (channel.title || '').toLowerCase().includes(artistName.toLowerCase()) && channel.browseId
            );
            
            // Si no hay coincidencia cercana, usar el primer canal
            if (!validChannel) {
              validChannel = youtubeChannels[0];
            }
            
            if (validChannel && validChannel.browseId) {
              console.log(`[ArtistNavigation] Canal de YouTube válido encontrado: ${validChannel.title} (ID: ${validChannel.browseId})`);
              
              const artistUrl = `/artist/${validChannel.browseId}`;
              navigateTo(artistUrl);
              
              return {
                success: true,
                id: validChannel.browseId,
                source: 'youtube_direct_api',
                artist: validChannel
              };
            }
          } else {
            console.warn(`[ArtistNavigation] No se encontraron canales de YouTube para "${artistName}"`);
          }
        } catch (youtubeError) {
          console.error(`[ArtistNavigation] Error buscando canales de YouTube:`, youtubeError);
        }
        
        // Si YouTube Music y YouTube API directa fallan, probar con YouTube API como fallback (método antiguo)
        console.log(`[ArtistNavigation] Intentando con YouTube API (antiguo método)...`);
        const youtubeApiResult = await searchYouTubeArtist(artistName);
        
        if (youtubeApiResult.success && youtubeApiResult.artist && youtubeApiResult.artist.browseId) {
          console.log(`[ArtistNavigation] Artista encontrado con YouTube API:`, youtubeApiResult.artist);
          
          // Construir URL del artista con el ID de canal de YouTube
          const artistUrl = `/artist/${youtubeApiResult.artist.browseId}`;
          console.log(`[ArtistNavigation] Navegando a: ${artistUrl}`);
          
          if (options.usarNavegacionDirecta !== false) {
            window.location.href = artistUrl;
          } else {
            navigateTo(artistUrl);
          }
          
          return {
            success: true,
            id: youtubeApiResult.artist.browseId,
            source: 'youtube_api',
            artist: youtubeApiResult.artist
          };
        }
        
        console.warn(`[ArtistNavigation] No se encontró artista en ninguna API`);
      }
      
      // Si llegamos aquí, no se encontró un artista válido
      console.log(`[ArtistNavigation] No se encontró un artista válido para "${artistName}"`);
      
      if (options.redirigirABusqueda !== false) {
        const searchUrl = `/search?q=${encodeURIComponent(artistName)}&filter=artists`;
        console.log(`[ArtistNavigation] Redirigiendo a búsqueda: ${searchUrl}`);
        navigateTo(searchUrl);
        return { 
          success: false, 
          redirectedToSearch: true, 
          searchTerm: artistName 
        };
      } else {
        // Si no se debe redirigir a búsqueda, ir a la URL de fallback
        console.log(`[ArtistNavigation] No redirigiendo a búsqueda, usando URL fallback: ${fallbackUrl}`);
        if (fallbackUrl !== "/artist/" + artistId) {
          navigateTo(fallbackUrl);
        }
        return { 
          success: false, 
          redirectedToSearch: false, 
          error: 'No se encontró el artista en YouTube Music ni en YouTube',
          fallbackUsed: true
        };
      }
    } catch (error) {
      console.error('[ArtistNavigation] Error al buscar artista por nombre:', error);
      
      // Si hay error y no se especificó lo contrario, navegar a la URL de fallback
      console.log(`[ArtistNavigation] Error en búsqueda, navegando a: ${fallbackUrl}`);
      navigateTo(fallbackUrl);
      return { 
        success: false, 
        error: `Error al buscar artista: ${(error as Error).message}`,
        fallbackUsed: true
      };
    }
  };

  /**
   * Busca un artista por nombre en YouTube Music sin navegar
   * @param artistName Nombre del artista para buscar
   * @returns Información del artista si se encuentra
   */
  const findArtistByName = async (artistName: string) => {
    try {
      console.log(`[ArtistNavigation] Buscando artista "${artistName}" en YouTube Music (sin navegación)`);
      
      // Intento 1: Buscar en YouTube Music
      try {
        const response = await axios.get('/api/youtube/search', {
          params: {
            query: artistName,
            filter: 'artists',
            limit: 5 // Aumentar para tener más opciones
          },
          timeout: 15000 // 15 segundos de timeout
        });
        
        // Determinar cómo procesar los resultados
        let artists = [];
        if (response.data && Array.isArray(response.data)) {
          artists = response.data;
        } else if (response.data && Array.isArray(response.data.results)) {
          artists = response.data.results;
        } else {
          console.warn(`[ArtistNavigation] Formato de respuesta inesperado:`, response.data);
          artists = [];
        }
        
        console.log(`[ArtistNavigation] Número de resultados para "${artistName}": ${artists.length}`);
        
        if (artists.length > 0) {
          // Primero buscar coincidencia exacta
          let validArtist: Artist | undefined = artists.find((artist: Artist) => 
            (artist.title || artist.name || '').toLowerCase() === artistName.toLowerCase() && artist.browseId
          );
          
          // Si no hay coincidencia exacta, usar el primer artista válido
          if (!validArtist) {
            validArtist = artists.find((artist: Artist) => artist.browseId);
          }
          
          if (validArtist) {
            console.log(`[ArtistNavigation] Artista válido encontrado:`, validArtist);
            
            if (validArtist.browseId) {
              console.log(`[ArtistNavigation] Artista encontrado: ${validArtist.title || validArtist.name} (ID: ${validArtist.browseId})`);
              return {
                success: true,
                artist: validArtist,
                source: 'youtube_music'
              };
            } else {
              console.warn(`[ArtistNavigation] Artista sin browseId:`, validArtist);
            }
          } else {
            console.warn(`[ArtistNavigation] No se encontró artista con browseId en los resultados:`, artists);
          }
        }
      } catch (ytmusicError) {
        console.warn(`[ArtistNavigation] Error al buscar en YouTube Music:`, ytmusicError);
        // Continuar con los otros métodos
      }
      
      // Intento 2: Buscar directamente con YouTube API por el nuevo endpoint
      if (isDemo) {
        try {
          console.log(`[ArtistNavigation] Intentando búsqueda directa con API de YouTube para "${artistName}"`);
          
          const youtubeResponse = await axios.get('/api/youtube/search-channels', {
            params: { query: artistName },
            timeout: 15000
          });
          
          if (youtubeResponse.data && 
              youtubeResponse.data.results && 
              youtubeResponse.data.results.length > 0) {
            
            const channels = youtubeResponse.data.results;
            console.log(`[ArtistNavigation] Se encontraron ${channels.length} canales con API directa de YouTube`);
            
            // Buscar coincidencia por nombre
            let validChannel = channels.find((channel: any) => 
              (channel.title || '').toLowerCase().includes(artistName.toLowerCase()));
            
            // Si no hay coincidencia, usar el primer canal
            if (!validChannel) {
              validChannel = channels[0];
            }
            
            if (validChannel && validChannel.browseId) {
              console.log(`[ArtistNavigation] Canal encontrado con API directa: ${validChannel.title} (ID: ${validChannel.browseId})`);
              
              return {
                success: true,
                artist: validChannel,
                source: 'youtube_direct_api'
              };
            }
          }
        } catch (youtubeDirectError) {
          console.warn(`[ArtistNavigation] Error en búsqueda directa con API de YouTube:`, youtubeDirectError);
        }
      }
      
      // Intento 3: Usar el método antiguo de searchYouTubeArtist
      console.warn(`[ArtistNavigation] No se encontraron resultados para "${artistName}" en YouTube Music, intentando con API de YouTube...`);
      
      // Intentar con la API de YouTube como fallback
      const youtubeApiResult = await searchYouTubeArtist(artistName);
      
      if (youtubeApiResult.success && youtubeApiResult.artist) {
        console.log(`[ArtistNavigation] Artista encontrado con YouTube API:`, youtubeApiResult.artist);
        return {
          success: true,
          artist: youtubeApiResult.artist,
          source: 'youtube_api'
        };
      }
      
      // Si llegamos aquí, no se encontró nada
      return {
        success: false,
        error: 'No se encontró el artista en YouTube Music ni en YouTube'
      };
    } catch (error) {
      console.error('[ArtistNavigation] Error al buscar artista:', error);
      return {
        success: false,
        error: `Error: ${(error as Error).message}`
      };
    }
  };

  return { 
    navigateToArtist,
    findArtistByName,
    convertSpotifyToYouTubeArtist
  };
} 