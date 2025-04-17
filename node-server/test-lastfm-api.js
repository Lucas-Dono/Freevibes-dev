/**
 * Script de prueba para la API de Last.fm
 * 
 * Este script realiza pruebas simples a la API de Last.fm para verificar
 * si el problema de error 403 es con la clave API, con la implementación,
 * o con alguna limitación de la API.
 */

const axios = require('axios');

// Configuración para Last.fm
// Usando solo la clave que confirmamos que funciona
const LASTFM_API_KEY = '4ef2cc2f144a00e44b7f1820f2768887';
const LASTFM_API_URL = 'https://ws.audioscrobbler.com/2.0/';

// Función para probar la búsqueda de artistas
async function testArtistSearch(query = 'karol') {
  console.log(`\n[TEST] Buscando artista "${query}"`);
  
  try {
    const response = await axios.get(LASTFM_API_URL, {
      params: {
        method: 'artist.search',
        artist: query,
        api_key: LASTFM_API_KEY,
        format: 'json',
        limit: 5
      },
      timeout: 5000
    });
    
    if (response.status === 200) {
      console.log('[✓] La API respondió correctamente (200 OK)');
      
      if (response.data && 
          response.data.results && 
          response.data.results.artistmatches && 
          response.data.results.artistmatches.artist) {
        
        const artists = response.data.results.artistmatches.artist;
        console.log(`[✓] Se encontraron ${artists.length} artistas`);
        artists.forEach((artist, index) => {
          console.log(`   ${index + 1}. ${artist.name}`);
        });
      } else {
        console.log('[!] La API respondió, pero la estructura de datos no es la esperada');
        console.log(JSON.stringify(response.data, null, 2).substring(0, 200) + '...');
      }
    } else {
      console.log(`[✗] La API respondió con código de error: ${response.status}`);
    }
    
    return true;
  } catch (error) {
    console.log(`[✗] Error al buscar artistas: ${error.message}`);
    
    if (error.response) {
      console.log(`   Código de respuesta: ${error.response.status}`);
      console.log(`   Mensaje de error: ${JSON.stringify(error.response.data)}`);
    }
    
    return false;
  }
}

// Función para probar la búsqueda de canciones
async function testTrackSearch(query = 'karol') {
  console.log(`\n[TEST] Buscando canción "${query}"`);
  
  try {
    const response = await axios.get(LASTFM_API_URL, {
      params: {
        method: 'track.search',
        track: query,
        api_key: LASTFM_API_KEY,
        format: 'json',
        limit: 5
      },
      timeout: 5000
    });
    
    if (response.status === 200) {
      console.log('[✓] La API respondió correctamente (200 OK)');
      
      if (response.data && 
          response.data.results && 
          response.data.results.trackmatches && 
          response.data.results.trackmatches.track) {
        
        const tracks = response.data.results.trackmatches.track;
        console.log(`[✓] Se encontraron ${tracks.length} canciones`);
        tracks.forEach((track, index) => {
          console.log(`   ${index + 1}. ${track.name} - ${track.artist}`);
        });
      } else {
        console.log('[!] La API respondió, pero la estructura de datos no es la esperada');
        console.log(JSON.stringify(response.data, null, 2).substring(0, 200) + '...');
      }
    } else {
      console.log(`[✗] La API respondió con código de error: ${response.status}`);
    }
    
    return true;
  } catch (error) {
    console.log(`[✗] Error al buscar canciones: ${error.message}`);
    
    if (error.response) {
      console.log(`   Código de respuesta: ${error.response.status}`);
      console.log(`   Mensaje de error: ${JSON.stringify(error.response.data)}`);
    }
    
    return false;
  }
}

// Función para probar la búsqueda de álbumes
async function testAlbumSearch(query = 'karol') {
  console.log(`\n[TEST] Buscando álbum "${query}"`);
  
  try {
    const response = await axios.get(LASTFM_API_URL, {
      params: {
        method: 'album.search',
        album: query,
        api_key: LASTFM_API_KEY,
        format: 'json',
        limit: 5
      },
      timeout: 5000
    });
    
    if (response.status === 200) {
      console.log('[✓] La API respondió correctamente (200 OK)');
      
      if (response.data && 
          response.data.results && 
          response.data.results.albummatches && 
          response.data.results.albummatches.album) {
        
        const albums = response.data.results.albummatches.album;
        console.log(`[✓] Se encontraron ${albums.length} álbumes`);
        albums.forEach((album, index) => {
          console.log(`   ${index + 1}. ${album.name} - ${album.artist}`);
        });
      } else {
        console.log('[!] La API respondió, pero la estructura de datos no es la esperada');
        console.log(JSON.stringify(response.data, null, 2).substring(0, 200) + '...');
      }
    } else {
      console.log(`[✗] La API respondió con código de error: ${response.status}`);
    }
    
    return true;
  } catch (error) {
    console.log(`[✗] Error al buscar álbumes: ${error.message}`);
    
    if (error.response) {
      console.log(`   Código de respuesta: ${error.response.status}`);
      console.log(`   Mensaje de error: ${JSON.stringify(error.response.data)}`);
    }
    
    return false;
  }
}

// Función principal para ejecutar todas las pruebas
async function runTests() {
  console.log('='.repeat(50));
  console.log('PRUEBA DE API DE LAST.FM');
  console.log('='.repeat(50));
  
  // Probar búsqueda de artistas
  await testArtistSearch();
  
  // Probar búsqueda de canciones
  await testTrackSearch();
  
  // Probar búsqueda de álbumes
  await testAlbumSearch();
  
  console.log('\n' + '='.repeat(50));
  console.log('FIN DE PRUEBAS');
  console.log('='.repeat(50));
}

// Ejecutar todas las pruebas
runTests().catch(error => {
  console.error('Error durante la ejecución de las pruebas:', error);
}); 