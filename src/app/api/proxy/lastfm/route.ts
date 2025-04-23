import { NextRequest, NextResponse } from 'next/server';

// Configuración de Last.fm desde variables de entorno
const API_KEY = process.env.LASTFM_API_KEY || '4ef2cc2f144a00e44b7f1820f2768887'; // Usar clave de respaldo
const API_URL = 'https://ws.audioscrobbler.com/2.0/';

// Lista de métodos permitidos para el proxy
const ALLOWED_METHODS = [
  'tag.gettoptracks',
  'track.search',
  'artist.search',
  'album.search',
  'track.getInfo',
  'artist.getInfo',
  'album.getInfo',
  'chart.gettoptracks',
  'geo.gettoptracks'
];

/**
 * Proxy para solicitudes a la API de Last.fm
 * Permite evitar problemas CORS y proteger la API key
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const method = searchParams.get('method') || 'tag.gettoptracks';

    // Verificar que el método solicitado está permitido
    if (!ALLOWED_METHODS.includes(method)) {
      return NextResponse.json(
        { error: `Método no permitido: ${method}` },
        { status: 400 }
      );
    }

    // Construir los parámetros para Last.fm
    const params = new URLSearchParams();
    params.append('method', method);
    params.append('api_key', API_KEY);
    params.append('format', 'json');

    // Copiar todos los demás parámetros de la solicitud original
    // Solución mejorada para procesar los parámetros
    searchParams.forEach((value, key) => {
      if (key !== 'method' && key !== 'api_key' && key !== 'format') {
        params.append(key, value);
      }
    });

    console.log(`[LastFM API] Proxy para: ${method}, params: ${params.toString()}`);

    // Realizar solicitud a Last.fm
    const response = await fetch(`${API_URL}?${params.toString()}`);

    if (!response.ok) {
      console.error(`[LastFM API] Error ${response.status}: ${response.statusText}`);
      return NextResponse.json(
        { error: `Error en API de Last.fm: ${response.status}` },
        { status: response.status }
      );
    }

    // Devolver los datos tal cual vienen de Last.fm
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[LastFM API] Error en proxy:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
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
          return mainGenre;
        }

        // O si coincide con algún subgénero
        for (const genre of subgenres) {
          if (genre.split(' ').includes(word)) {
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
      return word;
    }
  }

  // 4. Fallback final a un género popular genérico
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
