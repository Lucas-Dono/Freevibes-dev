/**
 * Script simple de prueba para la API de Last.fm
 * 
 * Este script prueba varias claves API para encontrar una que funcione
 */

const axios = require('axios');

// Varias claves API para probar (algunas de ejemplos públicos)
const API_KEYS = [
  // Claves de tu aplicación
  '74a19e2d981a4077a7a64c9f428db1dd',  // Del servidor
  '4ef2cc2f144a00e44b7f1820f2768887',   // De los .env
  
  // Claves de ejemplo de documentación pública (pueden no funcionar)
  '57ee3318536b23ee81d6b27e36997cde',  // Ejemplo de StackOverflow
  'YOUR_API_KEY'                        // Necesitas registrar tu propia clave
];

// Función simple para probar una clave API
async function testApiKey(apiKey) {
  console.log(`\nProbando clave API: ${apiKey.substring(0, 8)}...`);
  
  try {
    const response = await axios.get('https://ws.audioscrobbler.com/2.0/', {
      params: {
        method: 'artist.search',
        artist: 'Bad Bunny',
        api_key: apiKey,
        format: 'json',
        limit: 1
      },
      timeout: 5000
    });
    
    if (response.status === 200) {
      console.log('✅ ÉXITO: La API respondió correctamente');
      
      // Verificar si hay resultados
      if (response.data?.results?.artistmatches?.artist?.length > 0) {
        console.log(`   Artista encontrado: ${response.data.results.artistmatches.artist[0].name}`);
        return true;
      } else {
        console.log('⚠️ La API respondió pero no hay resultados');
        return false;
      }
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    
    if (error.response) {
      console.log(`   Código: ${error.response.status}`);
      if (error.response.data) {
        console.log(`   Mensaje: ${JSON.stringify(error.response.data)}`);
      }
    }
    
    return false;
  }
}

// Probar todas las claves API
async function testAllKeys() {
  console.log('=== PRUEBA DE CLAVES API DE LAST.FM ===');
  
  let foundWorkingKey = false;
  
  for (const apiKey of API_KEYS) {
    const works = await testApiKey(apiKey);
    if (works) {
      foundWorkingKey = true;
      console.log(`\n✅ CLAVE FUNCIONAL ENCONTRADA: ${apiKey}`);
    }
  }
  
  if (!foundWorkingKey) {
    console.log('\n❌ NINGUNA CLAVE FUNCIONA. Necesitas registrar una nueva clave API en Last.fm');
    console.log('   Visita: https://www.last.fm/api/account/create');
  }
}

// Ejecutar las pruebas
testAllKeys().catch(error => {
  console.error('Error al ejecutar pruebas:', error);
}); 