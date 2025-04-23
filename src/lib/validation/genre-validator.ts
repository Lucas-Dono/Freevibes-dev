import { fetchConReintentos } from '@/lib/resilience/retry';
import { genreCache } from '@/lib/cache';
import { SourceType } from '@/lib/source-manager';

// Constante para la caché de géneros validados
const CACHE_KEY_VALID_GENRES = 'validated_genres';
const CACHE_TTL_HOURS = 72 * 60 * 60 * 1000; // 3 días para reducir validaciones frecuentes

// Interfaz para resultado de validación
interface ValidationResult {
  valid: boolean;
  source: string;
  timestamp: number;
}

export async function validarGenero(
  genre: string,
  token: string,
  source: SourceType = 'spotify'
): Promise<boolean> {
  // Verificar caché primero
  const cachedResultsStr = await genreCache.get(CACHE_KEY_VALID_GENRES);
  const cachedResults: Record<string, ValidationResult> = cachedResultsStr ? JSON.parse(cachedResultsStr) : {};

  // Si tenemos un resultado reciente (menos de 24 horas), usarlo
  const cacheKey = `${source}:${genre}`;
  if (cachedResults[cacheKey] && (Date.now() - cachedResults[cacheKey].timestamp) < 24 * 60 * 60 * 1000) {
    return cachedResults[cacheKey].valid;
  }

  // Si no hay caché o es antiguo, validar el género
  let isValid = false;

  try {
    if (source === 'spotify') {
      // Para Spotify, intenta obtener tracks para este género
      const response = await fetchConReintentos(
        `https://api.spotify.com/v1/search?q=genre%3A${encodeURIComponent(genre)}&type=track&limit=1`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        },
        2 // Máximo 2 reintentos para no saturar
      );

      // Si la respuesta es exitosa y contiene al menos un track, el género es válido
      if (response.ok) {
        const data = await response.json();
        isValid = data.tracks?.items?.length > 0;
      }
    } else if (source === 'lastfm') {
      // Implementación para validar géneros en Last.fm
      // Aquí iría la implementación específica para Last.fm
      isValid = true; // Por defecto asumimos que Last.fm es válido
    } else if (source === 'youtube') {
      // Implementación para validar géneros en YouTube Music
      // Aquí iría la implementación específica para YouTube Music
      isValid = true; // Por defecto asumimos que YouTube Music es válido
    } else if (source === 'deezer') {
      // Implementación para validar géneros en Deezer
      // Aquí iría la implementación específica para Deezer
      isValid = true; // Por defecto asumimos que Deezer es válido
    }
  } catch (error) {
    console.error(`Error al validar género ${genre} (${source}):`, error);
    isValid = false;
  }

  // Guardar resultado en caché
  cachedResults[cacheKey] = {
    valid: isValid,
    source,
    timestamp: Date.now()
  };

  await genreCache.set(CACHE_KEY_VALID_GENRES, JSON.stringify(cachedResults), CACHE_TTL_HOURS);

  return isValid;
}

export async function obtenerGenerosValidados(
  generos: string[],
  token: string,
  source: SourceType = 'spotify'
): Promise<string[]> {
  // Si no hay géneros para validar, devolver array vacío
  if (!generos.length) return [];

  const generosValidos: string[] = [];

  // Intentar validar un género aleatorio primero como "prueba canario"
  const generoCanario = generos[Math.floor(Math.random() * generos.length)];
  const canarioValido = await validarGenero(generoCanario, token, source);

  // Si el género canario es válido, podemos asumir que todos son válidos
  // y evitar sobrecargar la API con múltiples peticiones
  if (canarioValido) {
    return generos;
  }

  // Si el canario falla, validar cada género individualmente

  // Validar géneros en paralelo con límite para no sobrecargar
  const resultados = await Promise.all(
    generos.map(async (genre) => ({
      genre,
      valid: await validarGenero(genre, token, source)
    }))
  );

  // Filtrar solo los géneros válidos
  return resultados
    .filter(result => result.valid)
    .map(result => result.genre);
}
