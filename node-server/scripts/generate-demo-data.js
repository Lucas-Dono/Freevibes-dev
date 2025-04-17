/**
 * Script para generar datos de demostración mejorados
 * Este script recopila datos de todos los archivos demo y genera un archivo
 * recommendations_general.json que contiene datos reales combinados.
 */

const fs = require('fs');
const path = require('path');

// Directorios base
const demoDir = path.join(__dirname, '../demo-data/spotify');
const outputDir = path.join(__dirname, '../demo-data/spotify');

// Función principal
async function main() {
  console.log('Generando datos de recomendaciones mejorados...');
  
  try {
    // Lista para almacenar todos los archivos a procesar
    let allFiles = [];
    
    // Leer archivos en el directorio principal
    const mainDirFiles = fs.readdirSync(demoDir)
      .filter(file => 
        file.endsWith('.json') && 
        file !== 'recommendations_general.json' &&
        file !== 'recommendations_multilanguage.json' &&
        !file.includes('fallback')
      )
      .map(file => path.join(demoDir, file));
    
    allFiles.push(...mainDirFiles);
    
    // Leer archivos de las subcarpetas de idioma
    const langDirs = ['es', 'en', 'fr', 'it'];
    
    for (const lang of langDirs) {
      const langDirPath = path.join(demoDir, lang);
      
      // Verificar si la carpeta existe
      if (fs.existsSync(langDirPath) && fs.statSync(langDirPath).isDirectory()) {
        const langFiles = fs.readdirSync(langDirPath)
          .filter(file => file.endsWith('.json'))
          .map(file => path.join(langDirPath, file));
        
        allFiles.push(...langFiles);
        console.log(`Encontrados ${langFiles.length} archivos en carpeta ${lang}/`);
      }
    }
    
    console.log(`Encontrados ${allFiles.length} archivos para combinar en total`);
    
    // Recopilar tracks de todos los archivos
    let allTracks = [];
    let tracksIdSet = new Set(); // Para evitar duplicados
    
    for (const filePath of allFiles) {
      try {
        const fileName = path.basename(filePath);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        // Extraer tracks basados en la estructura del archivo
        let tracks = [];
        
        // Procesar diferentes estructuras de archivos JSON
        if (data.items && Array.isArray(data.items)) {
          // Formato típico para saved_tracks, playlists, etc.
          tracks = data.items.map(item => {
            // Comprobar si el ítem contiene un track embebido
            if (item.track) return item.track;
            
            // Comprobar si es un artista
            if (item.type === 'artist' || (item.images && item.followers)) {
              // Ignorar artistas, no son tracks
              return null;
            }
            
            return item;
          }).filter(Boolean); // Eliminar nulos
          
        } else if (data.tracks && Array.isArray(data.tracks)) {
          // Formato para recommendations, search results, etc.
          tracks = data.tracks;
          
        } else if (data.tracks && data.tracks.items && Array.isArray(data.tracks.items)) {
          // Formato para top tracks de artista
          tracks = data.tracks.items;
          
        } else if (data.albums && data.albums.items && Array.isArray(data.albums.items)) {
          // Formato para new releases
          const albumTracks = [];
          data.albums.items.forEach(album => {
            if (album.tracks && Array.isArray(album.tracks.items)) {
              album.tracks.items.forEach(track => {
                albumTracks.push({
                  ...track,
                  album: {
                    id: album.id,
                    name: album.name,
                    images: album.images
                  }
                });
              });
            }
          });
          tracks = albumTracks;
          
        } else if (data.playlists && data.playlists.items && Array.isArray(data.playlists.items)) {
          // Formato para featured playlists - no contiene tracks directamente
          tracks = [];
          
        } else if (Array.isArray(data)) {
          // Algunos archivos pueden ser arrays directamente
          tracks = data;
        }
        
        // Filtrar tracks válidos y añadir solo si tienen identificadores únicos
        const validTracks = [];
        tracks.forEach(track => {
          if (!track) return;
          
          // Asegurarse de que es un track válido con los campos necesarios
          if (track.id && 
              (track.name || track.title) && 
              ((track.artists && track.artists.length > 0) || track.artist) &&
              ((track.album && track.album.images && track.album.images.length > 0) || track.cover)) {
            
            // Evitar duplicados
            if (!tracksIdSet.has(track.id)) {
              tracksIdSet.add(track.id);
              validTracks.push(track);
            }
          }
        });
        
        allTracks.push(...validTracks);
        console.log(`Procesado ${fileName}: ${validTracks.length} tracks válidos, ${allTracks.length} tracks acumulados`);
      } catch (err) {
        console.error(`Error procesando ${path.basename(filePath)}:`, err.message);
      }
    }
    
    // Mezclar aleatoriamente para más variedad
    allTracks = shuffleArray(allTracks);
    
    // Formatear como un objeto recommendations_general
    const finalData = {
      tracks: allTracks.slice(0, 100), // Limitar a 100 tracks para que no sea muy grande
      seeds: [
        { id: "pop", type: "GENRE", initialPoolSize: 500 },
        { id: "rock", type: "GENRE", initialPoolSize: 500 },
        { id: "hip-hop", type: "GENRE", initialPoolSize: 500 },
        { id: "electronic", type: "GENRE", initialPoolSize: 500 },
        { id: "latin", type: "GENRE", initialPoolSize: 500 }
      ]
    };
    
    // Guardar el resultado
    const outputPath = path.join(outputDir, 'recommendations_general.json');
    fs.writeFileSync(outputPath, JSON.stringify(finalData, null, 2));
    
    console.log(`✅ Generado archivo de recomendaciones con ${finalData.tracks.length} tracks.`);
    console.log(`Ruta: ${outputPath}`);
    
    // Solo crear recomendaciones por idioma si tenemos suficientes tracks
    if (allTracks.length > 0) {
      createMultiLanguageRecommendations(allTracks);
    } else {
      console.warn('⚠️ No se encontraron tracks suficientes para generar recomendaciones multilingüe');
      // Crear datos de fallback si no hay tracks
      createFallbackRecommendations();
    }
    
  } catch (error) {
    console.error('Error generando datos de recomendaciones:', error);
    // Crear datos de fallback en caso de error
    createFallbackRecommendations();
  }
}

// Función para generar datos de fallback si todo falla
function createFallbackRecommendations() {
  try {
    console.log('Generando datos de recomendaciones de fallback...');
    
    // Generar tracks de fallback
    const tracks = [];
    const languages = ['Español', 'English', 'Português', 'Français', 'Italiano'];
    const genres = ['Pop', 'Rock', 'Hip-Hop', 'Electrónica', 'Latino'];
    
    // Crear 50 tracks de fallback
    for (let i = 0; i < 50; i++) {
      const language = languages[i % languages.length];
      const genre = genres[Math.floor(Math.random() * genres.length)];
      
      tracks.push({
        id: `fallback_track_${i}`,
        name: `${language} ${genre} Track ${i+1}`,
        artists: [{
          id: `fallback_artist_${i % 10}`,
          name: `Artista ${language} ${i % 10 + 1}`
        }],
        album: {
          id: `fallback_album_${i % 15}`,
          name: `Álbum ${language} ${i % 15 + 1}`,
          images: [{
            url: `https://placehold.co/300x300/1DB954/FFFFFF?text=${encodeURIComponent(`${language} ${i % 15 + 1}`)}`,
            height: 300,
            width: 300
          }]
        },
        duration_ms: 180000 + (i * 10000),
        language
      });
    }
    
    // Guardar datos generales
    const generalData = {
      tracks: tracks.slice(0, 30),
      seeds: [
        { id: "pop", type: "GENRE", initialPoolSize: 500 },
        { id: "rock", type: "GENRE", initialPoolSize: 500 },
        { id: "hip-hop", type: "GENRE", initialPoolSize: 500 },
        { id: "electronic", type: "GENRE", initialPoolSize: 500 },
        { id: "latin", type: "GENRE", initialPoolSize: 500 }
      ]
    };
    
    fs.writeFileSync(
      path.join(outputDir, 'recommendations_general.json'),
      JSON.stringify(generalData, null, 2)
    );
    
    // Guardar datos multilingüe
    const multiData = {
      tracks: tracks.slice(0, 50)
    };
    
    fs.writeFileSync(
      path.join(outputDir, 'recommendations_multilanguage.json'),
      JSON.stringify(multiData, null, 2)
    );
    
    console.log('✅ Generados archivos de recomendaciones de fallback');
  } catch (error) {
    console.error('Error generando datos de fallback:', error);
  }
}

// Función para generar recomendaciones por idioma
function createMultiLanguageRecommendations(allTracks) {
  // Asignar idiomas "ficticios" a los tracks basados en patrones en sus nombres o artistas
  const languages = ['Español', 'English', 'Português', 'Français', 'Italiano'];
  const languageKeywords = {
    'Español': ['ft', 'el', 'la', 'los', 'para', 'con', 'mi', 'tu', 'yo', 'amor', 'vida', 'corazón', 'j balvin', 'bad bunny', 'ozuna', 'maluma', 'shakira', 'enrique', 'ricky', 'juanes'],
    'English': ['the', 'feat', 'and', 'love', 'you', 'me', 'we', 'us', 'heart', 'ed sheeran', 'dua lipa', 'justin', 'ariana', 'taylor', 'adele', 'beyonce'],
    'Português': ['de', 'em', 'com', 'para', 'anitta', 'seu jorge', 'caetano', 'roberto', 'marisa', 'maria', 'luciano'],
    'Français': ['de', 'la', 'les', 'est', 'pour', 'avec', 'dans', 'stromae', 'indila', 'louane', 'mylene', 'alizée'],
    'Italiano': ['di', 'il', 'la', 'che', 'non', 'per', 'con', 'bocelli', 'pausini', 'ramazzotti', 'ferro', 'giorgia']
  };
  
  const tracksByLanguage = {};
  languages.forEach(lang => {
    tracksByLanguage[lang] = [];
  });
  
  // Asignar cada track a un idioma basado en palabras clave
  allTracks.forEach(track => {
    const title = (track.name || track.title || '').toLowerCase();
    const artist = Array.isArray(track.artists) 
      ? track.artists.map(a => a.name || '').join(' ').toLowerCase() 
      : (track.artist || '').toLowerCase();
    const text = `${title} ${artist}`;
    
    let assigned = false;
    
    // Intentar asignar por palabras clave
    for (const lang in languageKeywords) {
      const keywords = languageKeywords[lang];
      const match = keywords.some(keyword => text.includes(keyword.toLowerCase()));
      
      if (match) {
        tracksByLanguage[lang].push({...track, language: lang});
        assigned = true;
        break;
      }
    }
    
    // Si no se pudo asignar, distribuir equitativamente
    if (!assigned) {
      // Asignar al idioma con menos tracks
      const minLang = languages.reduce((min, lang) => 
        tracksByLanguage[lang].length < tracksByLanguage[min].length ? lang : min, 
        languages[0]
      );
      tracksByLanguage[minLang].push({...track, language: minLang});
    }
  });
  
  // Crear objeto final con tracks por idioma
  const multiLanguageTracks = [];
  
  // Tomar máximo 20 tracks por idioma
  for (const lang in tracksByLanguage) {
    const langTracks = tracksByLanguage[lang].slice(0, 20);
    multiLanguageTracks.push(...langTracks);
  }
  
  // Mezclar para distribución equitativa
  const shuffledMultiLangTracks = shuffleArray(multiLanguageTracks);
  
  // Guardar archivo
  const outputPath = path.join(outputDir, 'recommendations_multilanguage.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    tracks: shuffledMultiLangTracks
  }, null, 2));
  
  console.log(`✅ Generado archivo de recomendaciones multilingüe con ${shuffledMultiLangTracks.length} tracks.`);
}

// Función para mezclar array aleatoriamente (algoritmo Fisher-Yates)
function shuffleArray(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

// Ejecutar script
main().catch(console.error); 