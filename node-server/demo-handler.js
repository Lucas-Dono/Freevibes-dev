const fs = require('fs');
const path = require('path');

// Mapa que asocia cada playlist con su artista principal
// Esto nos permitirá saber rápidamente qué archivo consultar
let playlistArtistMap = {}; // Formato: {playlistId: 'artistName'}

// Crear un índice que mapea artistas a sus archivos JSON
function initializeArtistIndex() {
  try {
    const artistFileMap = {};  // {artista: 'ruta_archivo'}
    const supportedLanguages = ['es', 'en', 'fr']; // Todos los idiomas soportados
    
    supportedLanguages.forEach(language => {
      const baseFolder = path.join(__dirname, 'demo-data', 'spotify', language);
      
      // Asegurarnos de que existe la carpeta para este idioma
      if (!fs.existsSync(baseFolder)) {
        console.warn(`La carpeta para el idioma ${language} no existe.`);
        return;
      }
      
      // Obtener todos los archivos de álbumes
      const albumFiles = fs.readdirSync(baseFolder)
        .filter(file => file.endsWith('albums.json'));
      
      // Crear un mapa temporal de playlist a artista para este idioma
      const tempPlaylistMap = {};
      
      // Procesar cada archivo
      albumFiles.forEach(file => {
        try {
          const filePath = path.join(baseFolder, file);
          const fileContent = fs.readFileSync(filePath, 'utf8');
          const data = JSON.parse(fileContent);
          
          if (data && data.playlists && Array.isArray(data.playlists)) {
            // Para cada playlist, determinar su artista principal
            data.playlists.forEach(playlist => {
              const mainArtist = getMainArtistFromPlaylist(playlist);
              
              // Si encontramos un artista principal válido
              if (mainArtist && mainArtist !== 'Artista Variado') {
                // Registrar el archivo para este artista
                if (!artistFileMap[language]) artistFileMap[language] = {};
                artistFileMap[language][mainArtist] = file;
                
                // Registrar esta playlist con su artista
                tempPlaylistMap[playlist.id] = mainArtist;
              }
            });
          }
        } catch (error) {
          console.error(`Error procesando archivo ${file}:`, error);
        }
      });
      
      // Combinar el mapa de playlists para este idioma
      // Format: {'es:playlistId': 'artistName'}
      Object.keys(tempPlaylistMap).forEach(playlistId => {
        playlistArtistMap[`${language}:${playlistId}`] = tempPlaylistMap[playlistId];
      });
    });
    
    return artistFileMap;
  } catch (error) {
    console.error('Error al inicializar índice de artistas:', error);
    return {};
  }
}

// Función auxiliar para determinar el artista principal de una playlist
function getMainArtistFromPlaylist(playlist) {
  if (!playlist.tracks || !playlist.tracks.items || playlist.tracks.items.length === 0) {
    return 'Artista Variado';
  }
  
  // Contar apariciones de cada artista
  const artistCounts = {};
  playlist.tracks.items.forEach(item => {
    if (item.track && item.track.artists && item.track.artists.length > 0) {
      const artistName = item.track.artists[0].name;
      artistCounts[artistName] = (artistCounts[artistName] || 0) + 1;
    }
  });
  
  // Encontrar el artista más frecuente
  let mainArtist = 'Artista Variado';
  let maxCount = 0;
  
  Object.entries(artistCounts).forEach(([artist, count]) => {
    if (count > maxCount) {
      maxCount = count;
      mainArtist = artist;
    }
  });
  
  return mainArtist;
}

// Inicializar el índice al cargar el módulo
const artistFileMap = initializeArtistIndex();

// Función actualizada para obtener todas las playlists destacadas
function getDemoPlaylists(language = 'es', limit = 10) {
  try {
    const baseFolder = path.join(__dirname, 'demo-data', 'spotify', language);
    
    // Verificar que existe la carpeta
    if (!fs.existsSync(baseFolder)) {
      console.warn(`La carpeta para el idioma ${language} no existe.`);
      return [];
    }
    
    // Buscar todos los archivos que terminen en albums.json
    const albumFiles = fs.readdirSync(baseFolder)
      .filter(file => file.endsWith('albums.json'));
    
    // Si no hay archivos, devolver array vacío
    if (albumFiles.length === 0) {
      console.warn(`No se encontraron archivos albums.json para el idioma ${language}`);
      return [];
    }
    
    // Seleccionar hasta 5 archivos aleatorios para diversidad
    const selectedFiles = albumFiles
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(5, albumFiles.length));
    
    // Array para almacenar todas las playlists encontradas
    const allPlaylists = [];
    
    // Procesar cada archivo seleccionado
    selectedFiles.forEach(file => {
      try {
        const filePath = path.join(baseFolder, file);
        
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(fileContent);
        
        // La estructura es diferente - estos son álbumes, no playlists
        // En lugar de buscar data.playlists, usamos data.items directamente
        if (data && data.items && Array.isArray(data.items)) {
          // Extraer el nombre del artista del nombre de archivo (artist_NOMBRE_albums.json)
          const fileNameParts = file.split('_');
          const artistNameFromFile = fileNameParts.length > 1 ? 
            fileNameParts.slice(1, -1).join(' ').replace('.json', '') : 'Artista';
          
          // Convertir álbumes a formato de playlist
          const playlists = data.items.map(album => {
            // Extrae los artistas del álbum
            const artistName = album.artists && album.artists.length > 0 ? 
                               album.artists[0].name : artistNameFromFile;
            
            return {
              id: album.id,
              name: album.name,
              description: `Álbum de ${artistName} - ${album.release_date}`,
              images: album.images || [],
              owner: { display_name: artistName },
              tracks: { 
                total: album.total_tracks || 0
              },
              artist: artistName,
              albumType: album.album_type,
              releaseDate: album.release_date
            };
          });
          
          allPlaylists.push(...playlists);
        } else {
          console.warn(`El archivo ${file} no tiene la estructura esperada (items)`);
        }
      } catch (error) {
        console.error(`Error procesando archivo ${file}:`, error);
      }
    });
    
    // Ordenar aleatoriamente
    allPlaylists.sort(() => Math.random() - 0.5);
    
    // Devolver limitado
    return allPlaylists.slice(0, limit);
  } catch (error) {
    console.error('Error obteniendo playlists de demo:', error);
    return [];
  }
}

// Función optimizada para obtener detalles de una playlist usando el mapa artista->archivo
function getPlaylistDetailsByArtist(playlistId, language = 'es') {
  try {
    // En nuestro caso, playlistId es el ID del álbum
    
    const baseFolder = path.join(__dirname, 'demo-data', 'spotify', language);
    
    // Verificar que existe la carpeta
    if (!fs.existsSync(baseFolder)) {
      console.warn(`La carpeta para el idioma ${language} no existe.`);
      return null;
    }
    
    // Buscar en todos los archivos de álbumes
    const albumFiles = fs.readdirSync(baseFolder)
      .filter(file => file.endsWith('albums.json'));
    
    // Procesar cada archivo para buscar el álbum
    for (const file of albumFiles) {
      const filePath = path.join(baseFolder, file);
      
      try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(fileContent);
        
        if (data && data.items && Array.isArray(data.items)) {
          // Buscar el álbum con el ID correspondiente
          const album = data.items.find(item => item.id === playlistId);
          
          if (album) {
            
            // Extraer el nombre del artista del nombre de archivo (artist_NOMBRE_albums.json)
            const fileNameParts = file.split('_');
            const artistNameFromFile = fileNameParts.length > 1 ? 
              fileNameParts.slice(1, -1).join(' ').replace('.json', '') : 'Artista';
            
            // Buscar las pistas del álbum en el archivo correspondiente
            const artistName = album.artists && album.artists.length > 0 ? 
                              album.artists[0].name : artistNameFromFile;
            
            // Intentar encontrar pistas del artista en archivos de top tracks
            const topTracksFileName = file.replace('albums.json', 'toptracks.json');
            const topTracksPath = path.join(baseFolder, topTracksFileName);
            
            let tracks = { items: [] };
            
            if (fs.existsSync(topTracksPath)) {
              try {
                const tracksContent = fs.readFileSync(topTracksPath, 'utf8');
                const tracksData = JSON.parse(tracksContent);
                
                if (tracksData && tracksData.tracks) {
                  // Usar las pistas del archivo de top tracks como canciones del álbum
                  tracks.items = tracksData.tracks.map(track => ({
                    added_at: new Date().toISOString(),
                    track: {
                      ...track,
                      album: album
                    }
                  })).slice(0, 10); // Limitar a 10 pistas
                  
                }
              } catch (tracksError) {
                console.error(`Error al cargar pistas de ${topTracksFileName}:`, tracksError);
              }
            }
            
            // Construir un objeto de playlist a partir del álbum
            return {
              id: album.id,
              name: album.name,
              description: `Álbum de ${artistName} - ${album.release_date}`,
              images: album.images || [],
              owner: { display_name: artistName },
              followers: { total: Math.floor(Math.random() * 50000) + 1000 },
              tracks: {
                total: album.total_tracks || tracks.items.length,
                items: tracks.items
              },
              mainArtist: artistName,
              albumType: album.album_type,
              releaseDate: album.release_date
            };
          }
        }
      } catch (fileError) {
        console.error(`Error procesando archivo ${file}:`, fileError);
      }
    }
    
    return null; // No se encontró el álbum
  } catch (error) {
    console.error(`Error obteniendo detalles de álbum ${playlistId}:`, error);
    return null;
  }
}

module.exports = {
  getDemoPlaylists,
  getPlaylistDetailsByArtist
}; 