import { NextResponse } from 'next/server';

interface Suggestion {
  id: string;
  text: string;
  type: 'artist' | 'track' | 'album';
  source: 'lastfm' | 'musicbrainz' | 'theaudiodb' | 'youtube' | 'local';
  artist?: string;
  trackName?: string;
  albumName?: string;
  imageUrl?: string;
  popularity?: number;
  mbid?: string; // MusicBrainz ID
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');
  const limit = parseInt(searchParams.get('limit') || '6');

  try {
    if (!query || query.trim().length < 2) {
      return NextResponse.json([]);
    }

    const suggestions: Suggestion[] = [];

    // 1. Intentar obtener sugerencias de MusicBrainz (completamente gratuita y muy precisa)
    try {
      const musicbrainzSuggestions = await fetchMusicBrainzSuggestions(query, Math.ceil(limit * 0.4));
      suggestions.push(...musicbrainzSuggestions);
    } catch (error) {
      console.warn('MusicBrainz suggestions failed:', error);
    }

    // 2. Complementar con LastFM si necesitamos más sugerencias
    if (suggestions.length < limit) {
      try {
        const lastfmSuggestions = await fetchLastFMSuggestions(query, Math.ceil((limit - suggestions.length) * 0.6));
        suggestions.push(...lastfmSuggestions);
      } catch (error) {
        console.warn('LastFM suggestions failed:', error);
      }
    }

    // 3. Agregar TheAudioDB para metadatos enriquecidos
    if (suggestions.length < limit) {
      try {
        const audiodbSuggestions = await fetchTheAudioDBSuggestions(query, limit - suggestions.length);
        suggestions.push(...audiodbSuggestions);
      } catch (error) {
        console.warn('TheAudioDB suggestions failed:', error);
      }
    }

    // 4. Si aún necesitamos más, intentar con YouTube
    if (suggestions.length < limit) {
      try {
        const youtubeSuggestions = await fetchYouTubeSuggestions(query, limit - suggestions.length);
        suggestions.push(...youtubeSuggestions);
      } catch (error) {
        console.warn('YouTube suggestions failed:', error);
      }
    }

    // 5. Fallback final: sugerencias locales inteligentes
    if (suggestions.length < limit) {
      const localSuggestions = getLocalSuggestions(query, limit - suggestions.length);
      suggestions.push(...localSuggestions);
    }

    // Eliminar duplicados y ordenar por relevancia
    const uniqueSuggestions = removeDuplicates(suggestions);
    const sortedSuggestions = sortByRelevance(uniqueSuggestions, query);

    return NextResponse.json(sortedSuggestions.slice(0, limit));
  } catch (error) {
    console.error('Error in combined suggestions:', error);
    return NextResponse.json(getLocalSuggestions(query || '', limit || 6));
  }
}

async function fetchMusicBrainzSuggestions(query: string, limit: number): Promise<Suggestion[]> {
  const suggestions: Suggestion[] = [];
  
  try {
    // Buscar artistas en MusicBrainz
    const artistResponse = await fetch(
      `https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent(query)}&fmt=json&limit=${Math.ceil(limit / 2)}`,
      { 
        next: { revalidate: 600 },
        headers: {
          'User-Agent': 'Freevibes/1.0 (https://freevibes.app)'
        }
      }
    );
    
    if (artistResponse.ok) {
      const artistData = await artistResponse.json();
      const artists = artistData.artists || [];
      
      artists.forEach((artist: any, index: number) => {
        if (artist.name && suggestions.length < limit) {
          suggestions.push({
            id: `musicbrainz-artist-${artist.id}`,
            text: artist.name,
            type: 'artist',
            source: 'musicbrainz',
            artist: artist.name,
            mbid: artist.id,
            popularity: artist.score || 0
          });
        }
      });
    }

    // Buscar releases (álbumes) si necesitamos más sugerencias
    if (suggestions.length < limit) {
      const releaseResponse = await fetch(
        `https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(query)}&fmt=json&limit=${limit - suggestions.length}`,
        { 
          next: { revalidate: 600 },
          headers: {
            'User-Agent': 'Freevibes/1.0 (https://freevibes.app)'
          }
        }
      );
      
      if (releaseResponse.ok) {
        const releaseData = await releaseResponse.json();
        const releases = releaseData.releases || [];
        
        releases.forEach((release: any, index: number) => {
          if (release.title && suggestions.length < limit) {
            const artistCredit = release['artist-credit']?.[0]?.name || 'Unknown Artist';
            suggestions.push({
              id: `musicbrainz-release-${release.id}`,
              text: `${release.title} - ${artistCredit}`,
              type: 'album',
              source: 'musicbrainz',
              artist: artistCredit,
              albumName: release.title,
              mbid: release.id,
              popularity: release.score || 0
            });
          }
        });
      }
    }
  } catch (error) {
    console.warn('MusicBrainz API error:', error);
  }

  return suggestions;
}

async function fetchTheAudioDBSuggestions(query: string, limit: number): Promise<Suggestion[]> {
  const suggestions: Suggestion[] = [];
  
  try {
    // Buscar artistas en TheAudioDB
    const artistResponse = await fetch(
      `https://www.theaudiodb.com/api/v1/json/2/search.php?s=${encodeURIComponent(query)}`,
      { next: { revalidate: 600 } }
    );
    
    if (artistResponse.ok) {
      const artistData = await artistResponse.json();
      const artists = artistData.artists || [];
      
      artists.slice(0, Math.ceil(limit / 2)).forEach((artist: any, index: number) => {
        if (artist.strArtist && suggestions.length < limit) {
          suggestions.push({
            id: `theaudiodb-artist-${artist.idArtist}`,
            text: artist.strArtist,
            type: 'artist',
            source: 'theaudiodb',
            artist: artist.strArtist,
            imageUrl: artist.strArtistThumb || artist.strArtistFanart,
            mbid: artist.strMusicBrainzArtistID,
            popularity: parseInt(artist.intFormedYear || '0')
          });
        }
      });
    }

    // Buscar álbumes si necesitamos más sugerencias
    if (suggestions.length < limit) {
      const albumResponse = await fetch(
        `https://www.theaudiodb.com/api/v1/json/2/searchalbum.php?s=${encodeURIComponent(query)}`,
        { next: { revalidate: 600 } }
      );
      
      if (albumResponse.ok) {
        const albumData = await albumResponse.json();
        const albums = albumData.album || [];
        
        albums.slice(0, limit - suggestions.length).forEach((album: any, index: number) => {
          if (album.strAlbum && album.strArtist && suggestions.length < limit) {
            suggestions.push({
              id: `theaudiodb-album-${album.idAlbum}`,
              text: `${album.strAlbum} - ${album.strArtist}`,
              type: 'album',
              source: 'theaudiodb',
              artist: album.strArtist,
              albumName: album.strAlbum,
              imageUrl: album.strAlbumThumb,
              mbid: album.strMusicBrainzID,
              popularity: parseInt(album.intYearReleased || '0')
            });
          }
        });
      }
    }
  } catch (error) {
    console.warn('TheAudioDB API error:', error);
  }

  return suggestions;
}

async function fetchLastFMSuggestions(query: string, limit: number): Promise<Suggestion[]> {
  const apiKey = process.env.NEXT_PUBLIC_LASTFM_API_KEY;
  if (!apiKey) throw new Error('LastFM API key not configured');

  const suggestions: Suggestion[] = [];

  // Buscar artistas
  try {
    const artistResponse = await fetch(
      `https://ws.audioscrobbler.com/2.0/?method=artist.search&artist=${encodeURIComponent(query)}&api_key=${apiKey}&format=json&limit=${Math.ceil(limit / 2)}`,
      { next: { revalidate: 300 } }
    );
    
    if (artistResponse.ok) {
      const artistData = await artistResponse.json();
      const artists = artistData.results?.artistmatches?.artist || [];
      
      (Array.isArray(artists) ? artists : [artists]).forEach((artist: any, index: number) => {
        if (artist.name && suggestions.length < limit) {
          suggestions.push({
            id: `lastfm-artist-${artist.mbid || index}`,
            text: artist.name,
            type: 'artist',
            source: 'lastfm',
            artist: artist.name,
            imageUrl: artist.image?.find((img: any) => img.size === 'medium')?.['#text'] || undefined,
            popularity: parseInt(artist.listeners || '0'),
            mbid: artist.mbid
          });
        }
      });
    }
  } catch (error) {
    console.warn('LastFM artist search failed:', error);
  }

  // Buscar tracks si aún necesitamos más sugerencias
  if (suggestions.length < limit) {
    try {
      const trackResponse = await fetch(
        `https://ws.audioscrobbler.com/2.0/?method=track.search&track=${encodeURIComponent(query)}&api_key=${apiKey}&format=json&limit=${limit - suggestions.length}`,
        { next: { revalidate: 300 } }
      );
      
      if (trackResponse.ok) {
        const trackData = await trackResponse.json();
        const tracks = trackData.results?.trackmatches?.track || [];
        
        (Array.isArray(tracks) ? tracks : [tracks]).forEach((track: any, index: number) => {
          if (track.name && track.artist && suggestions.length < limit) {
            suggestions.push({
              id: `lastfm-track-${track.mbid || index}`,
              text: `${track.name} - ${track.artist}`,
              type: 'track',
              source: 'lastfm',
              artist: track.artist,
              trackName: track.name,
              imageUrl: track.image?.find((img: any) => img.size === 'medium')?.['#text'] || undefined,
              popularity: parseInt(track.listeners || '0'),
              mbid: track.mbid
            });
          }
        });
      }
    } catch (error) {
      console.warn('LastFM track search failed:', error);
    }
  }

  return suggestions;
}

async function fetchYouTubeSuggestions(query: string, limit: number): Promise<Suggestion[]> {
  try {
    const nodeServerUrl = process.env.NEXT_PUBLIC_NODE_API_URL;
    if (!nodeServerUrl) throw new Error('Node server URL not configured');

    const response = await fetch(
      `${nodeServerUrl}/youtube/suggestions?query=${encodeURIComponent(query)}&limit=${limit}`,
      { next: { revalidate: 300 } }
    );
    
    if (response.ok) {
      const data = await response.json();
      return Array.isArray(data) ? data.map((item: any) => ({
        ...item,
        source: 'youtube' as const
      })) : [];
    }
  } catch (error) {
    console.warn('YouTube suggestions failed:', error);
  }
  
  return [];
}

function getLocalSuggestions(query: string, limit: number): Suggestion[] {
  const localData = [
    // Artistas populares con géneros
    { name: 'Bad Bunny', type: 'artist', popularity: 100, genre: 'reggaeton' },
    { name: 'Taylor Swift', type: 'artist', popularity: 95, genre: 'pop' },
    { name: 'Drake', type: 'artist', popularity: 90, genre: 'hip hop' },
    { name: 'Billie Eilish', type: 'artist', popularity: 88, genre: 'alternative pop' },
    { name: 'The Weeknd', type: 'artist', popularity: 85, genre: 'r&b' },
    { name: 'Ariana Grande', type: 'artist', popularity: 83, genre: 'pop' },
    { name: 'Post Malone', type: 'artist', popularity: 80, genre: 'hip hop' },
    { name: 'Dua Lipa', type: 'artist', popularity: 78, genre: 'pop' },
    { name: 'Ed Sheeran', type: 'artist', popularity: 75, genre: 'pop' },
    { name: 'Olivia Rodrigo', type: 'artist', popularity: 73, genre: 'pop rock' },
    
    // Géneros y términos populares
    { name: 'reggaeton hits', type: 'artist', popularity: 70, genre: 'reggaeton' },
    { name: 'pop music 2024', type: 'artist', popularity: 65, genre: 'pop' },
    { name: 'rock classics', type: 'artist', popularity: 60, genre: 'rock' },
    { name: 'hip hop beats', type: 'artist', popularity: 58, genre: 'hip hop' },
    { name: 'indie vibes', type: 'artist', popularity: 55, genre: 'indie' },
    { name: 'electronic dance', type: 'artist', popularity: 52, genre: 'electronic' },
    { name: 'jazz standards', type: 'artist', popularity: 50, genre: 'jazz' },
    { name: 'country roads', type: 'artist', popularity: 48, genre: 'country' },
    { name: 'latin rhythms', type: 'artist', popularity: 45, genre: 'latin' },
    { name: 'classical symphony', type: 'artist', popularity: 42, genre: 'classical' }
  ];

  const filtered = localData
    .filter(item => {
      const queryLower = query.toLowerCase();
      const nameLower = item.name.toLowerCase();
      const genreLower = item.genre?.toLowerCase() || '';
      
      return nameLower.includes(queryLower) || 
             queryLower.includes(nameLower.split(' ')[0]) ||
             genreLower.includes(queryLower) ||
             queryLower.includes(genreLower);
    })
    .slice(0, limit)
    .map((item, index) => ({
      id: `local-${index}`,
      text: item.name,
      type: item.type as 'artist' | 'track' | 'album',
      source: 'local' as const,
      artist: item.type === 'artist' ? item.name : undefined,
      popularity: item.popularity
    }));

  return filtered;
}

function removeDuplicates(suggestions: Suggestion[]): Suggestion[] {
  const seen = new Set<string>();
  return suggestions.filter(suggestion => {
    const key = suggestion.text.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sortByRelevance(suggestions: Suggestion[], query: string): Suggestion[] {
  const queryLower = query.toLowerCase();
  
  return suggestions.sort((a, b) => {
    // Prioridad por coincidencia exacta
    const aExact = a.text.toLowerCase() === queryLower ? 1000 : 0;
    const bExact = b.text.toLowerCase() === queryLower ? 1000 : 0;
    
    // Prioridad por inicio de palabra
    const aStarts = a.text.toLowerCase().startsWith(queryLower) ? 500 : 0;
    const bStarts = b.text.toLowerCase().startsWith(queryLower) ? 500 : 0;
    
    // Prioridad por contener la query
    const aContains = a.text.toLowerCase().includes(queryLower) ? 100 : 0;
    const bContains = b.text.toLowerCase().includes(queryLower) ? 100 : 0;
    
    // Prioridad por fuente (MusicBrainz > LastFM > TheAudioDB > YouTube > Local)
    const sourceWeight = { 
      musicbrainz: 60, 
      lastfm: 50, 
      theaudiodb: 45, 
      youtube: 30, 
      local: 10 
    };
    const aSource = sourceWeight[a.source] || 0;
    const bSource = sourceWeight[b.source] || 0;
    
    // Prioridad por popularidad
    const aPopularity = a.popularity || 0;
    const bPopularity = b.popularity || 0;
    
    // Bonus por tener MBID (MusicBrainz ID)
    const aMbidBonus = a.mbid ? 25 : 0;
    const bMbidBonus = b.mbid ? 25 : 0;
    
    const aScore = aExact + aStarts + aContains + aSource + (aPopularity / 10) + aMbidBonus;
    const bScore = bExact + bStarts + bContains + bSource + (bPopularity / 10) + bMbidBonus;
    
    return bScore - aScore;
  });
} 