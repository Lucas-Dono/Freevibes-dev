import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Garantizar que la ruta sea dinámica para que Next.js no la construya estáticamente
export const dynamic = 'force-dynamic';

// Ruta base para los archivos de datos demo
const DEMO_DATA_BASE_PATH = process.cwd() + '/node-server/demo-data/spotify';

/**
 * Carga un archivo JSON de datos demo
 */
async function loadDemoFile(filePath: string): Promise<any> {
  try {
    const fullPath = path.join(DEMO_DATA_BASE_PATH, filePath);
    console.log(`[Demo API] Cargando archivo: ${fullPath}`);
    
    const data = await fs.readFile(fullPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`[Demo API] Error al cargar archivo ${filePath}:`, error);
    
    // Si falla la carga de un archivo específico por idioma, intentar con el fallback en español
    if (!filePath.startsWith('es/') && filePath.includes('/')) {
      const parts = filePath.split('/');
      const fallbackPath = ['es', ...parts.slice(1)].join('/');
      console.log(`[Demo API] Intentando cargar fallback: ${fallbackPath}`);
      return loadDemoFile(fallbackPath);
    }
    
    throw new Error(`No se pudo cargar el archivo de datos demo: ${filePath}`);
  }
}

/**
 * Verifica si los datos demo están disponibles
 */
async function isDemoDataAvailable(): Promise<boolean> {
  try {
    await fs.access(DEMO_DATA_BASE_PATH);
    return true;
  } catch (error) {
    console.error('[Demo API] Error al verificar disponibilidad de datos demo:', error);
    return false;
  }
}

/**
 * Genera un historial aleatorio de canciones reproducidas usando los datos de canciones disponibles
 * @param language Idioma para obtener los datos
 * @param count Número de canciones a incluir en el historial
 */
async function generateRandomHistory(language: string, count: number = 10): Promise<any[]> {
  try {
    // Usar top tracks por privacidad en lugar de saved_tracks
    const topTracksData = await loadDemoFile(`${language}/top_tracks.json`);
    const topTracks = topTracksData.items || [];
    
    // Cargar también resultados de búsqueda para tener más variedad
    let searchTracks: any[] = [];
    try {
      const searchData = await loadDemoFile(`${language}/search_track.json`);
      if (searchData.tracks && searchData.tracks.items) {
        searchTracks = searchData.tracks.items;
        console.log(`[Demo API] Añadiendo ${searchTracks.length} tracks de búsqueda para el historial`);
      }
    } catch (error) {
      console.warn('[Demo API] No se pudieron cargar tracks de búsqueda para el historial', error);
    }
    
    // Cargar nuevos lanzamientos si es posible
    let newReleaseTracks: any[] = [];
    try {
      const newReleasesData = await loadDemoFile(`${language}/new_releases.json`);
      if (newReleasesData.albums?.items) {
        // Extraer una pista de cada álbum nuevo (simulada)
        newReleaseTracks = newReleasesData.albums.items.map((album: any) => ({
          id: `track_${album.id}`,
          name: `Track de ${album.name}`,
          artists: album.artists,
          album: album,
          duration_ms: Math.floor(Math.random() * 200000) + 100000 // Entre 100s y 300s
        }));
      }
    } catch (error) {
      console.warn('[Demo API] No se pudo cargar nuevos lanzamientos para el historial', error);
    }
    
    // Combinar todas las pistas disponibles
    const allTracks = [...topTracks, ...searchTracks, ...newReleaseTracks];
    
    if (allTracks.length === 0) {
      throw new Error('No hay suficientes tracks para generar historial');
    }
    
    // Seleccionar tracks aleatorios
    const randomHistory: any[] = [];
    const selectedIndexes = new Set<number>();
    
    for (let i = 0; i < Math.min(count, allTracks.length); i++) {
      // Generar índice aleatorio que no haya sido seleccionado
      let randomIndex: number;
      do {
        randomIndex = Math.floor(Math.random() * allTracks.length);
      } while (selectedIndexes.has(randomIndex));
      
      selectedIndexes.add(randomIndex);
      
      // Añadir la pista al historial con timestamp aleatorio (últimas 24 horas)
      const track = allTracks[randomIndex];
      const hoursAgo = Math.floor(Math.random() * 24);
      const minutesAgo = Math.floor(Math.random() * 60);
      
      randomHistory.push({
        track: track,
        played_at: new Date(Date.now() - (hoursAgo * 3600000 + minutesAgo * 60000)).toISOString()
      });
    }
    
    // Ordenar por timestamp (más reciente primero)
    return randomHistory.sort((a, b) => 
      new Date(b.played_at).getTime() - new Date(a.played_at).getTime()
    );
  } catch (error) {
    console.error('[Demo API] Error generando historial aleatorio:', error);
    throw error;
  }
}

/**
 * Endpoint API para servir datos demo
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint') || '';
    const language = searchParams.get('language') || 'es';
    
    // Verificar si los datos demo están disponibles
    const isAvailable = await isDemoDataAvailable();
    if (!isAvailable) {
      return NextResponse.json(
        { error: 'Los datos de modo demo no están disponibles.' },
        { status: 404 }
      );
    }
    
    // Determinar qué archivo cargar según el endpoint
    let filePath: string;
    let responseData: any = null;
    const artistId = searchParams.get('artistId');
    
    if (endpoint === 'artist' && artistId) {
      // Cargar datos de un artista específico
      const artistSlug = artistId.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
      filePath = `${language}/artist_${artistSlug}.json`;
    } else if (endpoint === 'artist-albums' && artistId) {
      // Cargar álbumes de un artista específico
      const artistSlug = artistId.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
      filePath = `${language}/artist_${artistSlug}_albums.json`;
    } else if (endpoint === 'artist-top-tracks' && artistId) {
      // Cargar top tracks de un artista específico
      const artistSlug = artistId.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
      filePath = `${language}/artist_${artistSlug}_toptracks.json`;
    } else if (endpoint === 'recently-played') {
      // Generar historial aleatorio de canciones reproducidas
      const count = parseInt(searchParams.get('limit') || '10');
      responseData = await generateRandomHistory(language, count);
      return NextResponse.json(responseData);
    } else if (endpoint === 'featured-artists') {
      // Cargar artistas destacados (usaremos search_artist.json que ya contiene todos los artistas)
      filePath = `${language}/search_artist.json`;
      console.log(`[Demo API] Usando archivo search_artist.json para artistas destacados`);
      const data = await loadDemoFile(filePath);
      
      // Mostrar información de diagnóstico sobre los artistas
      if (data && data.artists && data.artists.items) {
        const artistsInfo = data.artists.items.map((artist: any) => ({
          name: artist.name,
          popularity: artist.popularity || 0,
          hasImages: !!(artist.images && artist.images.length > 0)
        }));
        
        console.log(`[Demo API] Artistas disponibles en search_artist.json:`, 
          artistsInfo.length > 0 ? artistsInfo.slice(0, 5) : 'Ninguno');
        
        // Contar artistas por popularidad para diagnóstico
        const popularityStats = {
          total: artistsInfo.length,
          '0-49': artistsInfo.filter((a: any) => a.popularity < 50).length,
          '50-59': artistsInfo.filter((a: any) => a.popularity >= 50 && a.popularity < 60).length,
          '60+': artistsInfo.filter((a: any) => a.popularity >= 60).length,
          sinImagen: artistsInfo.filter((a: any) => !a.hasImages).length
        };
        
        console.log(`[Demo API] Estadísticas de popularidad:`, popularityStats);
        
        // Extraer artistas sin aplicar filtro de popularidad
        const topArtists = data.artists.items
          .filter((artist: any) => artist.images && artist.images.length > 0) // Solo incluir artistas con imágenes
          .slice(0, parseInt(searchParams.get('limit') || '10'));
        
        console.log(`[Demo API] Devolviendo ${topArtists.length} artistas destacados`);
        return NextResponse.json({ items: topArtists });
      } else {
        console.warn('[Demo API] No se encontraron artistas en search_artist.json');
      }
    } else if (endpoint === 'search-artists') {
      // Cargar búsqueda de artistas (manejo específico, igual que en el endpoint principal)
      console.log(`[Demo API] Búsqueda específica de artistas en modo demo`);
      filePath = `${language}/search_artist.json`;
      const data = await loadDemoFile(filePath);
      
      if (data && data.artists && data.artists.items) {
        // MODIFICADO: Filtrar artistas sin imágenes antes de devolverlos
        data.artists.items = data.artists.items.filter((artist: any) => 
          artist.images && artist.images.length > 0
        );
        console.log(`[Demo API] Encontrados ${data.artists.items.length} artistas con imágenes en búsqueda`);
      }
      
      // Devolver en el formato que espera el cliente (igual que el endpoint principal search-artists)
      return NextResponse.json({ items: data.artists?.items || [] });
    } else {
      // Mapear endpoints estándar a archivos
      switch (endpoint) {
        case 'featured-playlists':
          filePath = `${language}/featured_playlists.json`;
          console.log(`[Demo API] PLAYLISTS DESTACADAS: Cargando archivo ${filePath} para idioma ${language}`);
          break;
        case 'new-releases':
          filePath = `${language}/new_releases.json`;
          break;
        case 'top-tracks':
          filePath = `${language}/top_tracks.json`;
          break;
        case 'saved-tracks':
          console.log('[Demo API] Solicitando saved tracks, usando top_tracks para proteger privacidad');
          filePath = `${language}/top_tracks.json`;
          
          // Convertir el formato de top tracks al formato de saved tracks
          try {
            const topTracksData = await loadDemoFile(`${language}/top_tracks.json`);
            if (topTracksData && topTracksData.items && topTracksData.items.length > 0) {
              // Transformar a formato de saved tracks
              const savedTracksFormat = {
                href: "https://api.spotify.com/v1/me/tracks",
                items: topTracksData.items.map((track: any) => ({
                  added_at: new Date().toISOString(),
                  track: track
                })),
                limit: topTracksData.items.length,
                next: null,
                offset: 0,
                previous: null,
                total: topTracksData.items.length
              };
              return NextResponse.json(savedTracksFormat);
            }
          } catch (err) {
            console.warn('[Demo API] Error al convertir top tracks a saved tracks, continuando con flujo normal');
          }
          break;
        case 'top-artists':
          filePath = `${language}/search_artist.json`;
          console.log(`[Demo API] Usando archivo search_artist.json para top artistas`);
          const artistData = await loadDemoFile(`${language}/search_artist.json`);
          
          if (artistData && artistData.artists && artistData.artists.items) {
            // MODIFICADO: Extraer artistas con filtro para incluir solo los que tienen imágenes
            const topArtists = artistData.artists.items
              .filter((artist: any) => artist.images && artist.images.length > 0) // Solo incluir artistas con imágenes
              .slice(0, parseInt(searchParams.get('limit') || '10'));
            
            console.log(`[Demo API] Devolviendo ${topArtists.length} artistas top con imágenes`);
            return NextResponse.json({ items: topArtists });
          }
          break;
        case 'search':
          const type = searchParams.get('type') || 'track';
          filePath = `${language}/search_${type}.json`;
          break;
        case 'recommendations':
          filePath = 'recommendations_general.json';
          break;
        case 'recommendations-multilanguage':
          filePath = 'recommendations_multilanguage.json';
          console.log('[Demo API] Cargando recomendaciones multilingüe');
          break;
        default:
          return NextResponse.json(
            { error: `Endpoint no soportado: ${endpoint}` },
            { status: 400 }
          );
      }
    }
    
    // Cargar y devolver los datos
    console.log(`[Demo API] Solicitando datos de: ${filePath}`);
    const data = await loadDemoFile(filePath);
    
    // Si son playlists destacadas y estamos usando álbumes, asegurarnos de que se muestran correctamente
    if (endpoint === 'featured-playlists' && data && data.playlists && Array.isArray(data.playlists.items)) {
      console.log(`[Demo API] PLAYLISTS DESTACADAS: Procesando ${data.playlists.items.length} playlists`);
      
      // Imprimir los primeros elementos para diagnóstico
      if (data.playlists.items.length > 0) {
        const sampleItem = data.playlists.items[0];
        console.log(`[Demo API] PLAYLISTS DESTACADAS: Ejemplo primer elemento:`, {
          id: sampleItem.id,
          name: sampleItem.name,
          owner: sampleItem.owner?.display_name || 'No owner',
          hasArtists: !!sampleItem.artists
        });
      }
      
      // Asegurar que cada playlist tiene la información correcta de owner y name
      data.playlists.items = data.playlists.items.map((playlist: any) => {
        // Si la playlist ya tiene la estructura correcta, no hacer cambios
        if (playlist && playlist.owner && playlist.owner.display_name && 
            playlist.owner.display_name !== 'freevibes Demo') {
          return playlist;
        }
        
        // Intentar extraer información del artista si está disponible
        if (playlist.artists && playlist.artists.length > 0) {
          return {
            ...playlist,
            // Si estamos usando un álbum como playlist, usar artista como owner
            owner: {
              display_name: playlist.artists[0].name,
              id: playlist.artists[0].id
            }
          };
        }
        
        // Si no hay información de artista, usar un valor por defecto
        return {
          ...playlist,
          owner: {
            display_name: 'freevibes Demo',
            id: 'freevibes_demo'
          }
        };
      });
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Demo API] Error:', error);
    return NextResponse.json(
      { error: 'Error al obtener datos demo', message: (error as Error).message },
      { status: 500 }
    );
  }
} 