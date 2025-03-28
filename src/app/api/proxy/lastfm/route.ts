import { NextRequest, NextResponse } from 'next/server';

// Configuración de Last.fm desde variables de entorno
const API_KEY = process.env.LASTFM_API_KEY || '4ef2cc2f144a00e44b7f1820f2768887'; // Usar clave de respaldo comprobada
const API_URL = 'https://ws.audioscrobbler.com/2.0/';

// Log para depuración - ver qué API key está siendo usada realmente
console.log(`[Last.fm] API Key configurada: ${API_KEY}`);

/**
 * Proxy para solicitudes a la API de Last.fm
 * Permite evitar problemas CORS y proteger la API key
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const method = searchParams.get('method') || 'tag.gettoptracks';
    const tag = searchParams.get('tag');
    const limit = searchParams.get('limit') || '30';

    console.log(`[Last.fm Proxy Debug] Recibida solicitud con método: ${method}, tag: ${tag}, limit: ${limit}`);

    if (!method) {
      return NextResponse.json({ error: 'Método requerido' }, { status: 400 });
    }

    // Si estamos buscando por tag, asegurarnos que sea un género válido
    // Last.fm espera géneros musicales, no títulos completos de canciones
    let processedTag = tag;
    let alternativeTag = null;
    let originalTag = tag;

    if (tag && tag.length > 15) {
      // Si parece un título de canción, extraer posibles términos de género
      processedTag = simplifyTag(tag);
      console.log(`[Last.fm Proxy] Tag original: "${tag}" convertido a: "${processedTag}"`);
      
      // Si el procesamiento cambió sustancialmente la etiqueta, guardar la original como alternativa
      if (processedTag && processedTag.length < tag.length * 0.5) {
        alternativeTag = tag.split(' ')[0]; // Usar primera palabra como alternativa
        console.log(`[Last.fm Proxy] Guardando tag alternativo: ${alternativeTag}`);
      }
    }

    // Asegurarnos de usar al menos 10 resultados para tener más variedad
    // Pero para solicitar más en caso de que algunos resultados sean filtrados
    const requestLimit = Math.max(parseInt(limit) * 2, 20).toString();
    const actualLimit = parseInt(limit);
    console.log(`[Last.fm Proxy] Solicitando ${requestLimit} resultados (para filtrar a ${actualLimit})`);

    // Construir URL para Last.fm exactamente como la que funciona en Postman
    const urlParams = new URLSearchParams();
    urlParams.append('method', method);
    urlParams.append('api_key', API_KEY);
    urlParams.append('format', 'json');

    // Si hay un tag procesado, usar ese en lugar del original
    if (processedTag) {
      urlParams.append('tag', processedTag);
    } else if (tag) {
      urlParams.append('tag', tag);
    }

    // Agregar el límite si está especificado (usar el valor aumentado)
    if (requestLimit) {
      urlParams.append('limit', requestLimit);
    }

    // Copiar el resto de parámetros relevantes
    const searchParamsEntries = Array.from(searchParams.entries());
    for (const [key, value] of searchParamsEntries) {
      if (!['method', 'api_key', 'format', 'tag', 'limit'].includes(key)) {
        urlParams.append(key, value);
      }
    }

    const lastfmUrl = `${API_URL}?${urlParams.toString()}`;
    console.log(`[Last.fm Proxy] Llamando a: ${lastfmUrl}`);

    // Función para procesar la respuesta de Last.fm
    const fetchAndProcessLastFm = async (url: string): Promise<{data: any, source: string}> => {
      console.log(`[Last.fm Proxy Debug] Iniciando fetch a: ${url}`);
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'MusicVerse/1.0.0'
        },
        cache: 'no-store'
      });

      console.log(`[Last.fm Proxy Debug] Respuesta recibida con status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Last.fm Proxy Error] Error HTTP: ${response.status} ${response.statusText}, Detalles: ${errorText}`);
        throw new Error(`Error HTTP: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return { data, source: url };
    };

    try {
      // Intentar con la etiqueta procesada primero
      const result = await fetchAndProcessLastFm(lastfmUrl);
      const data = result.data;
      
      // Verificar si hay suficientes resultados
      const trackCount = data.tracks?.track?.length || 0;
      console.log(`[Last.fm Proxy Debug] Datos recibidos correctamente - Cantidad: ${trackCount} canciones`);
      
      // Si hay suficientes resultados, procesarlos y devolverlos
      if (trackCount > 0) {
        // Limitar a la cantidad solicitada originalmente
        if (data.tracks && data.tracks.track && data.tracks.track.length > actualLimit) {
          data.tracks.track = data.tracks.track.slice(0, actualLimit);
        }
        
        return NextResponse.json(data, {
          headers: {
            'Cache-Control': 'public, max-age=3600',
            'Access-Control-Allow-Origin': '*'
          }
        });
      } else if (alternativeTag) {
        // Si no hay resultados y tenemos un tag alternativo, intentar con él
        console.log(`[Last.fm Proxy] Sin resultados con tag principal, probando alternativo: ${alternativeTag}`);
        
        // Construir nueva URL con tag alternativo
        const altUrlParams = new URLSearchParams();
        altUrlParams.append('method', method);
        altUrlParams.append('api_key', API_KEY);
        altUrlParams.append('format', 'json');
        altUrlParams.append('tag', alternativeTag);
        altUrlParams.append('limit', requestLimit);
        
        const altLastfmUrl = `${API_URL}?${altUrlParams.toString()}`;
        const altResult = await fetchAndProcessLastFm(altLastfmUrl);
        const altData = altResult.data;
        
        // Verificar si hay suficientes resultados con el tag alternativo
        const altTrackCount = altData.tracks?.track?.length || 0;
        console.log(`[Last.fm Proxy Debug] Datos alternativos recibidos - Cantidad: ${altTrackCount} canciones`);
        
        if (altTrackCount > 0) {
          // Limitar a la cantidad solicitada originalmente
          if (altData.tracks && altData.tracks.track && altData.tracks.track.length > actualLimit) {
            altData.tracks.track = altData.tracks.track.slice(0, actualLimit);
          }
          
          return NextResponse.json(altData, {
            headers: {
              'Cache-Control': 'public, max-age=3600',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
      }
      
      // Si llegamos aquí, ninguno de los intentos produjo resultados suficientes
      // Intentar con un género genérico popular
      const genericTag = determineGenericTag(originalTag || 'pop');
      console.log(`[Last.fm Proxy] Sin resultados con tags específicos, probando género genérico: ${genericTag}`);
      
      const genUrlParams = new URLSearchParams();
      genUrlParams.append('method', method);
      genUrlParams.append('api_key', API_KEY);
      genUrlParams.append('format', 'json');
      genUrlParams.append('tag', genericTag);
      genUrlParams.append('limit', requestLimit);
      
      const genLastfmUrl = `${API_URL}?${genUrlParams.toString()}`;
      const genResult = await fetchAndProcessLastFm(genLastfmUrl);
      const genData = genResult.data;
      
      // Verificar si hay suficientes resultados con el género genérico
      const genTrackCount = genData.tracks?.track?.length || 0;
      console.log(`[Last.fm Proxy Debug] Datos de género genérico recibidos - Cantidad: ${genTrackCount} canciones`);
      
      if (genTrackCount > 0) {
        // Limitar a la cantidad solicitada originalmente
        if (genData.tracks && genData.tracks.track && genData.tracks.track.length > actualLimit) {
          genData.tracks.track = genData.tracks.track.slice(0, actualLimit);
        }
        
        return NextResponse.json(genData, {
          headers: {
            'Cache-Control': 'public, max-age=3600',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
      
      // Si todo lo anterior falló, devolver datos fallback
      console.log(`[Last.fm Proxy] Sin resultados en ningún intento, usando fallback`);
      return NextResponse.json(createFakeResponse(method, processedTag || genericTag || 'rock', actualLimit));
    } catch (apiError) {
      console.error(`[Last.fm Proxy] Error en llamada a API: ${apiError}`);
      // Si falla la llamada a la API, usar datos fallback
      return NextResponse.json(createFakeResponse(method, processedTag || tag || 'rock', actualLimit));
    }
  } catch (error) {
    console.error('[Last.fm Proxy] Error:', error);
    
    // Si ocurre algún error, devolver datos fallback
    const { searchParams } = new URL(request.url);
    const methodParam = searchParams.get('method') || 'tag.gettoptracks';
    const tagParam = searchParams.get('tag') || 'rock';
    const limitParam = parseInt(searchParams.get('limit') || '30');
    
    return NextResponse.json(createFakeResponse(methodParam, tagParam, Math.max(limitParam, 10)));
  }
}

/**
 * Simplifica un tag para convertirlo en un término de género
 */
function simplifyTag(tag: string): string {
  // Lista ampliada de géneros musicales
  const musicGenres = {
    // Géneros principales
    rock: ['rock', 'indie rock', 'alternative rock', 'hard rock', 'punk rock', 'classic rock', 'rock nacional', 'rock en español'],
    electronic: ['electronic', 'electronica', 'edm', 'house', 'techno', 'trance', 'dubstep', 'drum and bass', 'ambient', 'synthwave'],
    pop: ['pop', 'synth pop', 'dream pop', 'k-pop', 'j-pop', 'indie pop', 'pop rock', 'dance pop', 'electropop'],
    hip_hop: ['hip hop', 'rap', 'trap', 'drill', 'boom bap', 'lo-fi hip hop', 'rap en español', 'latin hip hop', 'urban'],
    rnb: ['r&b', 'soul', 'funk', 'neo soul', 'contemporary r&b'],
    metal: ['metal', 'heavy metal', 'black metal', 'death metal', 'thrash metal', 'doom metal', 'progressive metal', 'nu metal'],
    folk: ['folk', 'folk rock', 'indie folk', 'americana', 'traditional folk', 'acoustic'],
    jazz: ['jazz', 'bebop', 'smooth jazz', 'fusion', 'contemporary jazz', 'swing'],
    classical: ['classical', 'orchestra', 'symphony', 'piano', 'neoclassical', 'chamber music'],
    latin: ['latin', 'reggaeton', 'bachata', 'salsa', 'cumbia', 'merengue', 'latin pop', 'latin rock'],
    reggae: ['reggae', 'dub', 'ska', 'dancehall', 'roots reggae'],
    blues: ['blues', 'rhythm blues', 'chicago blues', 'delta blues', 'electric blues'],
    country: ['country', 'country rock', 'alt-country', 'country pop', 'outlaw country', 'bluegrass'],
    world: ['world', 'afrobeat', 'celtic', 'flamenco', 'indian classical', 'african', 'asian', 'middle eastern'],
    
    // Subgéneros específicos (en crecimiento)
    indie: ['indie', 'indie rock', 'indie pop', 'indie folk', 'indietronica', 'bedroom pop'],
    alternative: ['alternative', 'alt rock', 'alt pop', 'alt metal', 'alternative dance'],
    experimental: ['experimental', 'avant-garde', 'noise', 'post-rock', 'art rock', 'math rock'],
    punk: ['punk', 'post-punk', 'hardcore punk', 'pop punk', 'skatepunk', 'garage punk'],
    dance: ['dance', 'disco', 'dance-punk', 'dancehall', 'dance pop', 'eurodance'],
    ambient: ['ambient', 'dark ambient', 'drone', 'atmospheric', 'chill', 'meditation', 'sleep'],
    lo_fi: ['lo-fi', 'lofi', 'lo-fi beats', 'chillhop', 'bedroom'],
    soundtrack: ['soundtrack', 'film score', 'movie', 'cinematic', 'theme', 'instrumental'],
    instrumental: ['instrumental', 'post-rock', 'math rock', 'fusion']
  };

  // Transformar a minúsculas y limpiar
  const cleaned = tag.toLowerCase()
    .replace(/\([^)]*\)/g, '') // Eliminar paréntesis y su contenido
    .replace(/\s-\s.*$/, '')   // Eliminar todo después de un guión
    .replace(/\sfeat\..*$/i, '') // Eliminar "feat."
    .replace(/(remix|version|edit).*$/i, '') // Eliminar términos de versiones
    .trim();
    
  // Dividir en palabras para análisis
  const words = cleaned.split(' ');
  
  // 1. Buscar coincidencias exactas de géneros completos
  for (const [mainGenre, subgenres] of Object.entries(musicGenres)) {
    for (const genre of subgenres) {
      if (cleaned.includes(genre)) {
        // Si el género está presente como una frase, es alta prioridad
        if (cleaned.includes(` ${genre} `) || 
            cleaned.startsWith(`${genre} `) || 
            cleaned.endsWith(` ${genre}`) || 
            cleaned === genre) {
          console.log(`[Last.fm Proxy] Género encontrado: "${genre}"`);
          return genre;
        }
      }
    }
  }
  
  // 2. Buscar palabras individuales que puedan ser géneros
  for (const word of words) {
    if (word.length > 3) { // Ignorar palabras muy cortas
      for (const [mainGenre, subgenres] of Object.entries(musicGenres)) {
        // Revisamos si la palabra coincide con el género principal
        if (word === mainGenre || word === mainGenre + 's') {
          console.log(`[Last.fm Proxy] Palabra de género encontrada: "${mainGenre}"`);
          return mainGenre;
        }
        
        // O si coincide con algún subgénero
        for (const genre of subgenres) {
          if (genre.split(' ').includes(word)) {
            console.log(`[Last.fm Proxy] Palabra de subgénero encontrada: "${genre}"`);
            return genre;
          }
        }
      }
    }
  }
  
  // 3. Si todo falla, extraer palabras significativas como posibles términos de búsqueda
  const ignoredWords = ['the', 'and', 'feat', 'with', 'from', 'by', 'at', 'of', 'in', 'on', 'to', 'for'];
  
  for (const word of words) {
    if (word.length > 3 && !ignoredWords.includes(word)) {
      console.log(`[Last.fm Proxy] Usando palabra significativa: "${word}"`);
      return word;
    }
  }
  
  // 4. Fallback final a un género popular genérico
  console.log(`[Last.fm Proxy] No se encontró género, usando fallback "rock"`);
  return 'rock';
}

/**
 * Determina un género genérico basado en un tag o texto de entrada
 */
function determineGenericTag(input: string): string {
  const lowercaseInput = input.toLowerCase();
  
  // Mapeo de palabras clave a géneros populares
  const genreKeywords: Record<string, string[]> = {
    'rock': ['rock', 'guitar', 'band', 'alternative', 'indie'],
    'pop': ['pop', 'hit', 'chart', 'radio', 'catchy'],
    'electronic': ['electronic', 'edm', 'dance', 'techno', 'beat'],
    'hiphop': ['hip', 'hop', 'rap', 'urban', 'trap'],
    'jazz': ['jazz', 'smooth', 'saxophone', 'trumpet', 'piano'],
    'classical': ['classic', 'orchestra', 'symphon', 'bach', 'mozart'],
    'rnb': ['r&b', 'soul', 'groove', 'rhythm'],
    'country': ['country', 'western', 'folk', 'americana']
  };
  
  // Buscar coincidencias de palabras clave
  for (const [genre, keywords] of Object.entries(genreKeywords)) {
    for (const keyword of keywords) {
      if (lowercaseInput.includes(keyword)) {
        return genre;
      }
    }
  }
  
  // Género predeterminado si no hay coincidencias
  return 'pop';
}

/**
 * Crea una respuesta ficticia con la estructura esperada
 */
function createFakeResponse(method: string, tag: string = 'rock', limit: number = 30) {
  // Asegurarse de que limit tenga un valor sensible
  limit = Math.min(Math.max(limit, 1), 50);
  
  // Nombres de género para categorizar
  const genreNames = {
    rock: ['Rock Song', 'Alternative Rock', 'Classic Rock', 'Indie Rock', 'Hard Rock'],
    pop: ['Pop Hit', 'Dance Pop', 'Synth Pop', 'Electropop', 'Modern Pop'],
    electronic: ['EDM Track', 'House Mix', 'Techno Beat', 'Ambient Electronic', 'Trance'],
    hiphop: ['Hip Hop Track', 'Rap Song', 'Trap Beat', 'Urban Flow', 'Lo-fi Hip Hop'],
    indie: ['Indie Anthem', 'Indie Folk', 'Alternative Indie', 'Indie Pop', 'Bedroom Pop'],
    jazz: ['Jazz Standard', 'Smooth Jazz', 'Bebop', 'Jazz Fusion', 'Modern Jazz'],
    metal: ['Metal Anthem', 'Heavy Metal', 'Thrash Metal', 'Death Metal', 'Progressive Metal'],
    classical: ['Classical Piece', 'Piano Sonata', 'Orchestra Composition', 'Violin Concerto', 'Chamber Music'],
    folk: ['Folk Ballad', 'Traditional Folk', 'Contemporary Folk', 'Acoustic Folk', 'Folk Rock'],
    country: ['Country Road', 'Country Ballad', 'Modern Country', 'Outlaw Country', 'Country Pop'],
    latin: ['Latin Rhythm', 'Reggaeton Beat', 'Latin Pop', 'Salsa Classic', 'Cumbia'],
    blues: ['Blues Standard', 'Electric Blues', 'Delta Blues', 'Chicago Blues', 'Blues Rock'],
    reggae: ['Reggae Jam', 'Roots Reggae', 'Dub', 'Dancehall', 'Reggae Fusion'],
    rnb: ['R&B Groove', 'Soul Classic', 'Contemporary R&B', 'Neo Soul', 'Funk']
  };

  // Determinar el tipo de género para generar nombres apropiados
  let genreType = 'rock'; // Género por defecto
  
  if (tag) {
    const tagLower = tag.toLowerCase();
    for (const [key, _] of Object.entries(genreNames)) {
      if (tagLower.includes(key)) {
        genreType = key;
        break;
      }
    }
  }
  
  // Nombres de artistas para el género seleccionado
  const artistsByGenre = {
    rock: ['The Guitar Heroes', 'Rockin Band', 'Alternative Sound', 'Classic Rockers', 'Indie Rockers'],
    pop: ['Pop Sensation', 'Chart Toppers', 'Beat Makers', 'Synth Kings', 'Radio Stars'],
    electronic: ['Digital Producers', 'Beat Crafters', 'Electronic Collective', 'House Masters', 'Synth Project'],
    hiphop: ['Flow Masters', 'Rhyme Sayers', 'Beat Droppers', 'Urban Poets', 'Rap Collective'],
    indie: ['Indie Darlings', 'Folk Collective', 'The Undergrounds', 'Bedroom Artists', 'Lo-fi Project'],
    jazz: ['Jazz Ensemble', 'Smooth Quartet', 'Bebop Collective', 'Jazz Improvisers', 'Modern Jazz Trio'],
    metal: ['Metal Warriors', 'Heavy Riffs', 'Dark Metal', 'Thrash Collective', 'Progressive Metal Band'],
    classical: ['Symphony Orchestra', 'String Quartet', 'Piano Virtuosos', 'Classical Ensemble', 'Chamber Orchestra'],
    folk: ['Folk Storytellers', 'Acoustic Ensemble', 'Traditional Collective', 'Folk Trio', 'String Folk Band'],
    country: ['Country Roads Band', 'Nashville Sound', 'Outlaw Country Band', 'Western Collective', 'Country Balladeers'],
    latin: ['Latin Rhythm Collective', 'Reggaeton Stars', 'Salsa Band', 'Cumbia Kings', 'Latin Fusion Project'],
    blues: ['Blues Brothers', 'Delta Sound', 'Chicago Blues Band', 'Electric Blues Project', 'Blues Jam Collective'],
    reggae: ['Reggae Collective', 'Roots Project', 'Dub Masters', 'Island Rhythm', 'Reggae Fusion Band'],
    rnb: ['Soul Collective', 'R&B Project', 'Groove Masters', 'Neo Soul Ensemble', 'Funk Brothers']
  };
  
  // Generar albumes apropiados para el género
  const albumsByGenre = {
    rock: ['Rock Anthems', 'Guitar Heroes', 'Alternative Sounds', 'Classic Collection', 'Indie Vibes'],
    pop: ['Pop Hits', 'Chart Toppers', 'Synth Dreams', 'Radio Favorites', 'Dance Collection'],
    electronic: ['Digital Landscapes', 'House Sessions', 'Techno Nights', 'Electronic Dreams', 'Beat Collection'],
    hiphop: ['Rhythm & Flow', 'Urban Poetry', 'Beats & Rhymes', 'Street Chronicles', 'Hip Hop Essentials'],
    indie: ['Indie Essentials', 'Underground Gems', 'Bedroom Tapes', 'Lo-fi Collection', 'Indie Discoveries'],
    jazz: ['Jazz Standards', 'Smooth Collection', 'Bebop Sessions', 'Jazz Club Favorites', 'Modern Jazz Expressions'],
    metal: ['Metal Mayhem', 'Heavy Collection', 'Riffs & Solos', 'Thrash Classics', 'Progressive Metal Journey'],
    classical: ['Classical Masterpieces', 'Piano Sonatas', 'Orchestral Collection', 'Chamber Essentials', 'Symphony No. 5'],
    folk: ['Folk Tales', 'Acoustic Sessions', 'Traditional Collection', 'Folk Ballads', 'Stories & Songs'],
    country: ['Country Roads', 'Nashville Collection', 'Western Tales', 'Country Ballads', 'Outlaw Country'],
    latin: ['Latin Rhythms', 'Reggaeton Hits', 'Salsa Collection', 'Cumbia Kings', 'Latin Dance Party'],
    blues: ['Blues Collection', 'Delta Classics', 'Chicago Blues Sessions', 'Electric Blues', 'Blues Standards'],
    reggae: ['Reggae Classics', 'Roots Collection', 'Dub Sessions', 'Island Rhythms', 'Reggae Essentials'],
    rnb: ['Soul Collection', 'R&B Grooves', 'Funk Sessions', 'Neo Soul Expressions', 'Smooth Jams']
  };
  
  switch (method) {
    case 'tag.gettoptracks':
      return {
        tracks: {
          track: Array(limit).fill(null).map((_, i) => {
            const songNames = genreNames[genreType as keyof typeof genreNames] || genreNames.rock;
            const artists = artistsByGenre[genreType as keyof typeof artistsByGenre] || artistsByGenre.rock;
            const albums = albumsByGenre[genreType as keyof typeof albumsByGenre] || albumsByGenre.rock;
            
            return {
              name: `${songNames[i % songNames.length]} ${i+1}`,
              artist: { name: artists[i % artists.length] },
              album: { title: albums[i % albums.length] },
              image: [{ '#text': `https://placehold.co/300x300/darkblue/white?text=${genreType.charAt(0).toUpperCase() + genreType.slice(1)}`, size: 'large' }],
              duration: '180000',
              mbid: `fallback-track-${i}-${genreType}`
            };
          })
        }
      };
    case 'tag.getsimilar':
      const similarGenres = {
        rock: ['indie rock', 'alternative', 'classic rock', 'hard rock', 'punk'],
        pop: ['dance pop', 'electropop', 'indie pop', 'synth pop', 'teen pop'],
        electronic: ['house', 'techno', 'trance', 'dubstep', 'ambient'],
        hiphop: ['rap', 'trap', 'drill', 'boom bap', 'lo-fi hip hop'],
        indie: ['indie rock', 'indie pop', 'indie folk', 'alternative', 'lo-fi'],
        jazz: ['bebop', 'smooth jazz', 'fusion', 'swing', 'contemporary jazz'],
        metal: ['heavy metal', 'thrash metal', 'death metal', 'progressive metal', 'black metal'],
        classical: ['orchestra', 'chamber music', 'piano', 'symphony', 'baroque'],
        folk: ['indie folk', 'americana', 'traditional folk', 'acoustic', 'singer-songwriter'],
        country: ['country rock', 'outlaw country', 'country pop', 'americana', 'bluegrass'],
        latin: ['reggaeton', 'latin pop', 'salsa', 'bachata', 'cumbia'],
        blues: ['electric blues', 'chicago blues', 'delta blues', 'blues rock', 'rhythm blues'],
        reggae: ['dub', 'roots reggae', 'dancehall', 'ska', 'reggae fusion'],
        rnb: ['soul', 'neo soul', 'contemporary r&b', 'funk', 'hip hop']
      };
      
      const relatedGenres = similarGenres[genreType as keyof typeof similarGenres] || similarGenres.rock;
      
      return {
        similartags: {
          tag: relatedGenres.map(tag => ({
            name: tag,
            url: `https://www.last.fm/tag/${tag.replace(/ /g, '+')}`
          }))
        }
      };
    default:
      return { status: 'ok', results: [] };
  }
} 