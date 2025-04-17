import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import fs from 'fs';
import path from 'path';
import { mkdir, writeFile } from 'fs/promises';

// Garantizar que la ruta sea dinámica para que Next.js no la construya estáticamente
export const dynamic = 'force-dynamic';

// Directorio base para guardar los datos demo
const DEMO_DATA_DIR = path.join(process.cwd(), 'node-server', 'demo-data', 'spotify');

export async function POST(req: NextRequest) {
  try {
    // Verificar autenticación
    const session = await getServerSession(authOptions);
    
    if (!session || !session.accessToken) {
      return NextResponse.json({ error: 'No autorizado. Se requiere sesión de Spotify.' }, { status: 401 });
    }
    
    // Obtener idiomas a procesar desde el cuerpo de la solicitud
    const body = await req.json();
    const languages = body.languages || ['es', 'en', 'fr', 'it'];
    
    if (!Array.isArray(languages) || languages.length === 0) {
      return NextResponse.json({ error: 'Se requiere al menos un idioma' }, { status: 400 });
    }
    
    // Asegurar que los directorios existan
    await ensureDirectories(languages);
    
    // Obtener token de acceso de la sesión
    const accessToken = session.accessToken;
    
    // Registrar el inicio del proceso
    console.log('[DEMO] Iniciando recopilación de datos para modo demo...');
    console.log(`[DEMO] Idiomas a procesar: ${languages.join(', ')}`);
    
    // Recopilar datos de perfil de usuario
    const userProfile = await fetchFromSpotify('/me', {}, accessToken);
    await saveData('user_profile.json', userProfile);
    
    // Mapeo de idiomas a locales y países
    const localeMap: Record<string, { locale: string, country: string }> = {
      'es': { locale: 'es_ES', country: 'ES' },
      'en': { locale: 'en_US', country: 'US' },
      'fr': { locale: 'fr_FR', country: 'FR' },
      'it': { locale: 'it_IT', country: 'IT' }
    };
    
    // Procesar datos para cada idioma
    for (const lang of languages) {
      const { locale, country } = localeMap[lang] || { locale: 'en_US', country: 'US' };
      
      console.log(`[DEMO] Procesando datos para idioma: ${lang} (${locale}, ${country})`);
      
      // Playlists destacadas
      console.log(`[DEMO] Obteniendo playlists destacadas para ${locale}...`);
      const featuredPlaylists = await fetchFromSpotify('/browse/featured-playlists', {
        locale,
        country,
        limit: 30
      }, accessToken);
      await saveData(`${lang}/featured_playlists.json`, featuredPlaylists);
      
      // Nuevos lanzamientos
      console.log(`[DEMO] Obteniendo nuevos lanzamientos para ${country}...`);
      const newReleases = await fetchFromSpotify('/browse/new-releases', {
        country,
        limit: 30
      }, accessToken);
      await saveData(`${lang}/new_releases.json`, newReleases);
      
      // Top tracks del usuario
      console.log(`[DEMO] Obteniendo top tracks para ${lang}...`);
      const topTracks = await fetchFromSpotify('/me/top/tracks', {
        limit: 20,
        time_range: 'medium_term'
      }, accessToken);
      await saveData(`${lang}/top_tracks.json`, topTracks);
      
      // Tracks guardados
      console.log(`[DEMO] Obteniendo tracks guardados para ${lang}...`);
      const savedTracks = await fetchFromSpotify('/me/tracks', {
        limit: 20
      }, accessToken);
      await saveData(`${lang}/saved_tracks.json`, savedTracks);
      
      // Artistas populares por idioma
      const popularArtists: Record<string, string[]> = {
        'es': ['Rosalía', 'Bad Bunny', 'C. Tangana'],
        'en': ['Taylor Swift', 'Drake', 'Billie Eilish'],
        'fr': ['Stromae', 'Aya Nakamura', 'Indochine'],
        'it': ['Måneskin', 'Laura Pausini', 'Eros Ramazzotti']
      };
      
      // Procesar artistas populares
      for (const artistName of popularArtists[lang] || popularArtists['en']) {
        console.log(`[DEMO] Buscando datos para artista: ${artistName}`);
        
        // Buscar artista
        const searchResults = await fetchFromSpotify('/search', {
          q: artistName,
          type: 'artist',
          limit: 1
        }, accessToken);
        
        if (searchResults.artists?.items?.length > 0) {
          const artist = searchResults.artists.items[0];
          const artistId = artist.id;
          const normalizedName = artistName.toLowerCase().replace(/\s+/g, '_');
          
          // Guardar datos del artista
          await saveData(`${lang}/artist_${normalizedName}.json`, artist);
          
          // Top tracks del artista
          const artistTopTracks = await fetchFromSpotify(`/artists/${artistId}/top-tracks`, {
            country
          }, accessToken);
          await saveData(`${lang}/artist_${normalizedName}_toptracks.json`, artistTopTracks);
          
          // Álbumes del artista
          const artistAlbums = await fetchFromSpotify(`/artists/${artistId}/albums`, {
            limit: 10
          }, accessToken);
          await saveData(`${lang}/artist_${normalizedName}_albums.json`, artistAlbums);
        }
        
        // Búsqueda de tracks
        const trackSearch = await fetchFromSpotify('/search', {
          q: artistName,
          type: 'track',
          limit: 20
        }, accessToken);
        await saveData(`${lang}/search_${artistName.toLowerCase().replace(/\s+/g, '_')}_track.json`, trackSearch);
      }
      
      // Búsqueda genérica
      const searchTypes = ['track', 'album', 'artist', 'playlist'];
      for (const type of searchTypes) {
        // Término de búsqueda adecuado para cada idioma
        const searchTerms: Record<string, string> = {
          'es': 'pop latino',
          'en': 'pop hits',
          'fr': 'chanson française',
          'it': 'musica italiana'
        };
        
        const searchTerm = searchTerms[lang] || searchTerms['en'];
        
        console.log(`[DEMO] Realizando búsqueda de ${type} con término: ${searchTerm}`);
        
        const searchResult = await fetchFromSpotify('/search', {
          q: searchTerm,
          type,
          limit: 20,
          market: country
        }, accessToken);
        
        await saveData(`${lang}/search_${type}.json`, searchResult);
      }
      
      // Recomendaciones basadas en géneros populares
      const genreMap: Record<string, string[]> = {
        'es': ['latin', 'reggaeton', 'spanish', 'flamenco'],
        'en': ['pop', 'rock', 'hip-hop', 'dance'],
        'fr': ['french', 'chanson', 'disco', 'electronic'],
        'it': ['italian', 'opera', 'indie-pop', 'cantautorato']
      };
      
      // Obtener géneros disponibles
      const availableGenres = await fetchFromSpotify('/recommendations/available-genre-seeds', {}, accessToken);
      
      // Filtrar géneros que existen en la API de Spotify
      const validGenres = genreMap[lang]?.filter(g => 
        availableGenres.genres?.includes(g)
      ) || ['pop', 'rock'];
      
      if (validGenres.length > 0) {
        console.log(`[DEMO] Obteniendo recomendaciones para géneros: ${validGenres.join(', ')}`);
        
        const recommendations = await fetchFromSpotify('/recommendations', {
          seed_genres: validGenres.slice(0, 5).join(','),
          limit: 30,
          market: country
        }, accessToken);
        
        await saveData(`${lang}/recommendations.json`, recommendations);
      }
    }
    
    // Recomendaciones generales
    console.log('[DEMO] Obteniendo recomendaciones generales...');
    const generalRecommendations = await fetchFromSpotify('/recommendations', {
      seed_genres: 'pop,rock,hip-hop,electronic,latin',
      limit: 30
    }, accessToken);
    await saveData('recommendations_general.json', generalRecommendations);
    
    // Devolver respuesta exitosa
    return NextResponse.json({
      success: true,
      message: `Datos demo inicializados correctamente para ${languages.length} idiomas`,
      languages
    });
    
  } catch (error) {
    console.error('[DEMO] Error durante la inicialización del modo demo:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido durante la inicialización'
    }, { status: 500 });
  }
}

/**
 * Función auxiliar para realizar solicitudes a la API de Spotify
 */
async function fetchFromSpotify(endpoint: string, params: Record<string, any> = {}, token: string) {
  // Construir URL con parámetros
  const url = new URL(`https://api.spotify.com/v1${endpoint}`);
  Object.keys(params).forEach(key => {
    url.searchParams.append(key, params[key]);
  });
  
  try {
    // Realizar solicitud
    console.log(`[DEMO] Solicitando: ${url.toString()}`);
    
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (parseError) {
        console.error(`[DEMO] Error al analizar respuesta de error: ${parseError}`);
        errorData = { error: "No se pudo procesar la respuesta" };
      }
      
      console.error(`[DEMO] Error ${response.status} en solicitud a ${endpoint}:`, errorData);
      
      // Si es cualquier error 4xx, usamos datos mock
      if (response.status >= 400 && response.status < 500) {
        console.log(`[DEMO] Generando datos mock para ${endpoint} por error ${response.status}`);
        return generateMockData(endpoint, params);
      }
      
      throw new Error(`Error en solicitud a Spotify: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Log de éxito
    console.log(`[DEMO] ✅ Datos obtenidos con éxito para: ${endpoint}`);
    
    return data;
  } catch (error) {
    console.error(`[DEMO] Error de conexión a ${endpoint}:`, error);
    console.log(`[DEMO] Fallback: Generando datos mock para ${endpoint}`);
    return generateMockData(endpoint, params);
  }
}

/**
 * Genera datos mock para endpoints que fallan
 */
function generateMockData(endpoint: string, params: Record<string, any>) {
  const country = params.country || 'ES';
  const locale = params.locale || 'es_ES';
  
  // Datos mock básicos por tipo de endpoint
  if (endpoint.includes('/browse/featured-playlists')) {
    return {
      message: `¡Las mejores playlists para ti! (Mock - ${locale})`,
      playlists: {
        href: `https://api.spotify.com/v1/browse/featured-playlists?country=${country}&locale=${locale}`,
        items: Array(10).fill(null).map((_, i) => ({
          id: `mock_playlist_${i}`,
          name: `Playlist Demo ${i+1}`,
          description: `Playlist de demostración ${i+1} para ${locale}`,
          images: [{
            url: `https://placehold.co/600x600/1DB954/FFFFFF?text=Demo+Playlist+${i+1}`,
            height: 600,
            width: 600
          }],
          owner: {
            display_name: "freevibes Demo",
            id: "freevibes"
          },
          tracks: {
            total: 25 + i
          }
        })),
        limit: 10,
        offset: 0,
        total: 10
      }
    };
  }
  
  if (endpoint.includes('/browse/new-releases')) {
    return {
      albums: {
        href: `https://api.spotify.com/v1/browse/new-releases?country=${country}`,
        items: Array(10).fill(null).map((_, i) => ({
          id: `mock_album_${i}`,
          name: `Álbum Demo ${i+1}`,
          artists: [{
            id: `mock_artist_${i}`,
            name: `Artista Demo ${i+1}`
          }],
          images: [{
            url: `https://placehold.co/600x600/1DB954/FFFFFF?text=Demo+Album+${i+1}`,
            height: 600,
            width: 600
          }],
          release_date: new Date().toISOString().split('T')[0],
          total_tracks: 12
        })),
        limit: 10,
        offset: 0,
        total: 10
      }
    };
  }
  
  if (endpoint.includes('/me/top/tracks')) {
    return {
      items: Array(10).fill(null).map((_, i) => ({
        id: `mock_track_${i}`,
        name: `Canción Top ${i+1}`,
        artists: [{
          id: `mock_artist_${i}`,
          name: `Artista Top ${i+1}`
        }],
        album: {
          id: `mock_album_${i}`,
          name: `Álbum Top ${i+1}`,
          images: [{
            url: `https://placehold.co/600x600/1DB954/FFFFFF?text=Top+Track+${i+1}`,
            height: 600,
            width: 600
          }]
        },
        duration_ms: 210000 + (i * 10000)
      })),
      limit: 10,
      offset: 0,
      total: 10
    };
  }
  
  if (endpoint.includes('/me/tracks')) {
    return {
      items: Array(10).fill(null).map((_, i) => ({
        track: {
          id: `mock_saved_track_${i}`,
          name: `Canción Guardada ${i+1}`,
          artists: [{
            id: `mock_artist_${i}`,
            name: `Artista Guardado ${i+1}`
          }],
          album: {
            id: `mock_album_${i}`,
            name: `Álbum Guardado ${i+1}`,
            images: [{
              url: `https://placehold.co/600x600/1DB954/FFFFFF?text=Saved+Track+${i+1}`,
              height: 600,
              width: 600
            }]
          },
          duration_ms: 210000 + (i * 10000)
        },
        added_at: new Date().toISOString()
      })),
      limit: 10,
      offset: 0,
      total: 10
    };
  }
  
  if (endpoint.includes('/search')) {
    const type = params.type || 'track';
    return {
      [type + 's']: {
        href: `https://api.spotify.com/v1/search?q=${params.q}&type=${type}`,
        items: Array(10).fill(null).map((_, i) => {
          if (type === 'track') {
            return {
              id: `mock_search_track_${i}`,
              name: `${params.q} - Resultado ${i+1}`,
              artists: [{
                id: `mock_artist_${i}`,
                name: `Artista ${i+1}`
              }],
              album: {
                id: `mock_album_${i}`,
                name: `Álbum ${i+1}`,
                images: [{
                  url: `https://placehold.co/600x600/1DB954/FFFFFF?text=${encodeURIComponent(params.q)}+${i+1}`,
                  height: 600,
                  width: 600
                }]
              },
              duration_ms: 210000 + (i * 10000)
            };
          } else if (type === 'artist') {
            return {
              id: `mock_artist_${i}`,
              name: `${params.q} - Artista ${i+1}`,
              images: [{
                url: `https://placehold.co/600x600/1DB954/FFFFFF?text=Artist+${i+1}`,
                height: 600,
                width: 600
              }],
              genres: ["pop", "rock"]
            };
          } else if (type === 'album') {
            return {
              id: `mock_album_${i}`,
              name: `${params.q} - Álbum ${i+1}`,
              artists: [{
                id: `mock_artist_${i}`,
                name: `Artista ${i+1}`
              }],
              images: [{
                url: `https://placehold.co/600x600/1DB954/FFFFFF?text=Album+${i+1}`,
                height: 600,
                width: 600
              }]
            };
          } else if (type === 'playlist') {
            return {
              id: `mock_playlist_${i}`,
              name: `${params.q} - Playlist ${i+1}`,
              description: `Playlist de ${params.q}`,
              images: [{
                url: `https://placehold.co/600x600/1DB954/FFFFFF?text=Playlist+${i+1}`,
                height: 600,
                width: 600
              }],
              owner: {
                display_name: "freevibes Demo"
              },
              tracks: {
                total: 25 + i
              }
            };
          }
          return {};
        }),
        limit: 10,
        offset: 0,
        total: 10
      }
    };
  }
  
  if (endpoint.includes('/recommendations')) {
    return {
      tracks: Array(10).fill(null).map((_, i) => ({
        id: `mock_recommendation_${i}`,
        name: `Recomendación ${i+1}`,
        artists: [{
          id: `mock_artist_${i}`,
          name: `Artista Recomendado ${i+1}`
        }],
        album: {
          id: `mock_album_${i}`,
          name: `Álbum Recomendado ${i+1}`,
          images: [{
            url: `https://placehold.co/600x600/1DB954/FFFFFF?text=Recommendation+${i+1}`,
            height: 600,
            width: 600
          }]
        },
        duration_ms: 210000 + (i * 10000)
      })),
      seeds: params.seed_genres?.split(',').map((genre: string) => ({
        id: genre,
        type: "GENRE",
        initialPoolSize: 500
      })) || []
    };
  }
  
  // Default para cualquier otro endpoint
  return {
    message: "Datos mock generados para endpoint no reconocido",
    endpoint,
    params
  };
}

/**
 * Asegura que existan los directorios necesarios
 */
async function ensureDirectories(languages: string[]) {
  // Crear directorio base si no existe
  try {
    await mkdir(DEMO_DATA_DIR, { recursive: true });
    console.log(`[DEMO] Directorio base creado: ${DEMO_DATA_DIR}`);
  } catch (error) {
    // Ignorar error si el directorio ya existe
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  }
  
  // Crear directorios para cada idioma
  for (const lang of languages) {
    const langDir = path.join(DEMO_DATA_DIR, lang);
    
    try {
      await mkdir(langDir, { recursive: true });
      console.log(`[DEMO] Directorio para idioma creado: ${lang}`);
    } catch (error) {
      // Ignorar error si el directorio ya existe
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }
}

/**
 * Guarda datos en un archivo JSON
 */
async function saveData(fileName: string, data: any) {
  const filePath = path.join(DEMO_DATA_DIR, fileName);
  
  try {
    // Crear directorio padre si no existe
    const dirPath = path.dirname(filePath);
    await mkdir(dirPath, { recursive: true });
    
    // Para search_artist.json, search_track.json, etc., acumular datos en lugar de reemplazar
    if (fileName.includes('search_') && !fileName.includes('search_rosalía_') && 
        !fileName.includes('search_bad_bunny_') && !fileName.includes('search_c._tangana_')) {
      
      let combinedData = data;
      
      // Intentar leer datos existentes si el archivo ya existe
      try {
        if (fs.existsSync(filePath)) {
          console.log(`[DEMO] Archivo existente encontrado: ${fileName}, combinando datos...`);
          const existingContent = fs.readFileSync(filePath, 'utf8');
          const existingData = JSON.parse(existingContent);
          
          // Combinar datos según el tipo
          if (fileName.includes('search_artist')) {
            combinedData = await mergeArtistsData(existingData, data);
          } else if (fileName.includes('search_track')) {
            combinedData = await mergeTracksData(existingData, data);
          } else if (fileName.includes('search_album')) {
            combinedData = await mergeAlbumsData(existingData, data);
          } else if (fileName.includes('search_playlist')) {
            combinedData = await mergePlaylistsData(existingData, data);
          }
          
          console.log(`[DEMO] Datos combinados para ${fileName}. Nuevos elementos añadidos.`);
        }
      } catch (readError) {
        console.error(`[DEMO] Error al leer/combinar datos existentes para ${fileName}:`, readError);
        // Si hay error, continuamos con los datos originales
      }
      
      // Guardar datos combinados
      await writeFile(filePath, JSON.stringify(combinedData, null, 2), 'utf8');
      console.log(`[DEMO] ✅ Datos acumulados guardados: ${fileName}`);
    } else {
      // Para otros archivos, simplemente reemplazar
      await writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
      console.log(`[DEMO] ✅ Datos guardados: ${fileName}`);
    }
  } catch (error) {
    console.error(`[DEMO] ❌ Error al guardar ${fileName}:`, error);
    throw error;
  }
}

/**
 * Combina datos de artistas eliminando duplicados por ID
 */
async function mergeArtistsData(existingData: any, newData: any): Promise<any> {
  if (!existingData.artists?.items || !newData.artists?.items) {
    return newData; // Si alguno no tiene la estructura esperada, devolver los nuevos datos
  }
  
  const existingArtists = existingData.artists.items;
  const newArtists = newData.artists.items;
  
  // Filtrar artistas sin imágenes en los datos nuevos
  const newArtistsWithImages = newArtists.filter((artist: any) => 
    artist && artist.images && artist.images.length > 0
  );
  
  // Crear un mapa de IDs existentes para comprobar duplicados de forma eficiente
  const existingIds = new Set(existingArtists.map((a: any) => a.id));
  
  // Filtrar artistas nuevos que no existan ya
  const uniqueNewArtists = newArtistsWithImages.filter((a: any) => !existingIds.has(a.id));
  
  console.log(`[DEMO] Artistas existentes: ${existingArtists.length}, Artistas nuevos únicos: ${uniqueNewArtists.length}`);
  
  // Combinar ambos arrays
  const combinedArtists = [...existingArtists, ...uniqueNewArtists];
  
  // Ordenar por popularidad descendente para que los más populares aparezcan primero
  combinedArtists.sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0));
  
  // Reconstruir objeto con la misma estructura
  return {
    ...newData,
    artists: {
      ...newData.artists,
      items: combinedArtists,
      total: combinedArtists.length
    }
  };
}

/**
 * Combina datos de tracks eliminando duplicados por ID
 */
async function mergeTracksData(existingData: any, newData: any): Promise<any> {
  if (!existingData.tracks?.items || !newData.tracks?.items) {
    return newData; // Si alguno no tiene la estructura esperada, devolver los nuevos datos
  }
  
  const existingTracks = existingData.tracks.items;
  const newTracks = newData.tracks.items;
  
  // Filtrar tracks sin imágenes en los datos nuevos
  const newTracksWithImages = newTracks.filter((track: any) => 
    track && track.album && track.album.images && track.album.images.length > 0
  );
  
  // Crear un mapa de IDs existentes para comprobar duplicados de forma eficiente
  const existingIds = new Set(existingTracks.map((t: any) => t.id));
  
  // Filtrar tracks nuevos que no existan ya
  const uniqueNewTracks = newTracksWithImages.filter((t: any) => !existingIds.has(t.id));
  
  console.log(`[DEMO] Tracks existentes: ${existingTracks.length}, Tracks nuevos únicos: ${uniqueNewTracks.length}`);
  
  // Combinar ambos arrays
  const combinedTracks = [...existingTracks, ...uniqueNewTracks];
  
  // Ordenar por popularidad descendente para que los más populares aparezcan primero
  combinedTracks.sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0));
  
  // Reconstruir objeto con la misma estructura
  return {
    ...newData,
    tracks: {
      ...newData.tracks,
      items: combinedTracks,
      total: combinedTracks.length
    }
  };
}

/**
 * Combina datos de álbumes eliminando duplicados por ID
 */
async function mergeAlbumsData(existingData: any, newData: any): Promise<any> {
  if (!existingData.albums?.items || !newData.albums?.items) {
    return newData; // Si alguno no tiene la estructura esperada, devolver los nuevos datos
  }
  
  const existingAlbums = existingData.albums.items;
  const newAlbums = newData.albums.items;
  
  // Filtrar álbumes sin imágenes en los datos nuevos
  const newAlbumsWithImages = newAlbums.filter((album: any) => 
    album && album.images && album.images.length > 0
  );
  
  // Crear un mapa de IDs existentes para comprobar duplicados de forma eficiente
  const existingIds = new Set(existingAlbums.map((a: any) => a.id));
  
  // Filtrar álbumes nuevos que no existan ya
  const uniqueNewAlbums = newAlbumsWithImages.filter((a: any) => !existingIds.has(a.id));
  
  console.log(`[DEMO] Álbumes existentes: ${existingAlbums.length}, Álbumes nuevos únicos: ${uniqueNewAlbums.length}`);
  
  // Combinar ambos arrays
  const combinedAlbums = [...existingAlbums, ...uniqueNewAlbums];
  
  // Ordenar por fecha de lanzamiento descendente (más recientes primero)
  combinedAlbums.sort((a: any, b: any) => {
    if (!a.release_date) return 1;
    if (!b.release_date) return -1;
    return new Date(b.release_date).getTime() - new Date(a.release_date).getTime();
  });
  
  // Reconstruir objeto con la misma estructura
  return {
    ...newData,
    albums: {
      ...newData.albums,
      items: combinedAlbums,
      total: combinedAlbums.length
    }
  };
}

/**
 * Combina datos de playlists eliminando duplicados por ID
 */
async function mergePlaylistsData(existingData: any, newData: any): Promise<any> {
  if (!existingData.playlists?.items || !newData.playlists?.items) {
    return newData; // Si alguno no tiene la estructura esperada, devolver los nuevos datos
  }
  
  const existingPlaylists = existingData.playlists.items;
  const newPlaylists = newData.playlists.items;
  
  // Filtrar playlists sin imágenes en los datos nuevos
  const newPlaylistsWithImages = newPlaylists.filter((playlist: any) => 
    playlist && playlist.images && playlist.images.length > 0
  );
  
  // Crear un mapa de IDs existentes para comprobar duplicados de forma eficiente
  const existingIds = new Set(existingPlaylists.map((p: any) => p.id));
  
  // Filtrar playlists nuevas que no existan ya
  const uniqueNewPlaylists = newPlaylistsWithImages.filter((p: any) => !existingIds.has(p.id));
  
  console.log(`[DEMO] Playlists existentes: ${existingPlaylists.length}, Playlists nuevas únicas: ${uniqueNewPlaylists.length}`);
  
  // Combinar ambos arrays
  const combinedPlaylists = [...existingPlaylists, ...uniqueNewPlaylists];
  
  // Reconstruir objeto con la misma estructura
  return {
    ...newData,
    playlists: {
      ...newData.playlists,
      items: combinedPlaylists,
      total: combinedPlaylists.length
    }
  };
} 