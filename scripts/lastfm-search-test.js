/**
 * Script de prueba para buscar en Last.fm
 *
 * Este script realiza búsquedas en la API de Last.fm para obtener
 * canciones, álbumes y artistas relacionados con un término de búsqueda.
 */

const fetch = require('node-fetch');

// Configuración
const LASTFM_API_KEY = '4ef2cc2f144a00e44b7f1820f2768887';
const LASTFM_API_URL = 'https://ws.audioscrobbler.com/2.0/';
const SEARCH_TERM = 'Emilia Mernes';

/**
 * Realiza una búsqueda en Last.fm
 */
async function searchLastFm(method, term, limit = 5) {
  // Determinar el parámetro correcto según el método
  const paramName = method.startsWith('track') ? 'track' :
                   method.startsWith('artist') ? 'artist' :
                   method.startsWith('album') ? 'album' : 'tag';

  const url = `${LASTFM_API_URL}?method=${method}&${paramName}=${encodeURIComponent(term)}&api_key=${LASTFM_API_KEY}&format=json&limit=${limit}`;

  console.log(`\nRealizando búsqueda: ${method} para "${term}"`);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Error en API: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Error en búsqueda ${method}:`, error);
    return null;
  }
}

/**
 * Muestra un título con formato
 */
function printTitle(title) {
  console.log('\n' + '='.repeat(50));
  console.log(`  ${title.toUpperCase()}`);
  console.log('='.repeat(50));
}

/**
 * Función principal que ejecuta todas las búsquedas
 */
async function runTests() {
  printTitle(`Búsqueda de "${SEARCH_TERM}" en Last.fm`);

  // 1. Buscar artistas
  const artistResults = await searchLastFm('artist.search', SEARCH_TERM);
  if (artistResults && artistResults.results && artistResults.results.artistmatches) {
    const artists = artistResults.results.artistmatches.artist;

    printTitle('Artistas encontrados');
    if (artists.length === 0) {
      console.log('No se encontraron artistas');
    } else {
      artists.forEach((artist, index) => {
        console.log(`${index + 1}. ${artist.name}`);
        console.log(`   Listeners: ${artist.listeners}`);
        console.log(`   URL: ${artist.url}`);
        if (artist.image && artist.image.length > 0) {
          console.log(`   Imagen: ${artist.image[1]['#text']}`);
        }
        console.log('---');
      });
    }
  }

  // 2. Buscar canciones
  const trackResults = await searchLastFm('track.search', SEARCH_TERM);
  if (trackResults && trackResults.results && trackResults.results.trackmatches) {
    const tracks = trackResults.results.trackmatches.track;

    printTitle('Canciones encontradas');
    if (tracks.length === 0) {
      console.log('No se encontraron canciones');
    } else {
      tracks.forEach((track, index) => {
        console.log(`${index + 1}. ${track.name} - ${track.artist}`);
        console.log(`   Listeners: ${track.listeners}`);
        console.log(`   URL: ${track.url}`);
        if (track.image && track.image.length > 0) {
          console.log(`   Imagen: ${track.image[1]['#text']}`);
        }
        console.log('---');
      });
    }
  }

  // 3. Buscar álbumes
  const albumResults = await searchLastFm('album.search', SEARCH_TERM);
  if (albumResults && albumResults.results && albumResults.results.albummatches) {
    const albums = albumResults.results.albummatches.album;

    printTitle('Álbumes encontrados');
    if (albums.length === 0) {
      console.log('No se encontraron álbumes');
    } else {
      albums.forEach((album, index) => {
        console.log(`${index + 1}. ${album.name} - ${album.artist}`);
        console.log(`   URL: ${album.url}`);
        if (album.image && album.image.length > 0) {
          console.log(`   Imagen: ${album.image[1]['#text']}`);
        }
        console.log('---');
      });
    }
  }

  // 4. Extra: obtener información detallada de la primera canción encontrada
  if (trackResults && trackResults.results && trackResults.results.trackmatches &&
      trackResults.results.trackmatches.track.length > 0) {

    const firstTrack = trackResults.results.trackmatches.track[0];
    const trackInfo = await searchLastFm('track.getInfo', firstTrack.name, 1);

    printTitle(`Información detallada de "${firstTrack.name}"`);

    if (trackInfo && trackInfo.track) {
      const track = trackInfo.track;
      console.log(`Nombre: ${track.name}`);
      console.log(`Artista: ${track.artist.name}`);

      if (track.album) {
        console.log(`Álbum: ${track.album.title}`);
        if (track.album.image && track.album.image.length > 0) {
          console.log(`Imagen del álbum: ${track.album.image[2]['#text']}`);
        }
      } else {
        console.log('No se encontró información del álbum');
      }

      console.log(`Duración: ${Math.floor(track.duration / 1000 / 60)}:${String(Math.floor((track.duration / 1000) % 60)).padStart(2, '0')}`);
      console.log(`URL: ${track.url}`);
    } else {
      console.log('No se pudo obtener información detallada de la canción');
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('  PRUEBA COMPLETADA');
  console.log('='.repeat(50) + '\n');
}

// Ejecutar el script
runTests().catch(err => {
  console.error('Error ejecutando pruebas:', err);
  process.exit(1);
});
