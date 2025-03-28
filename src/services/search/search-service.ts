import axios from 'axios';
import { YouTubeMusicAPI } from '../youtube/youtube-music-api';
import * as SpotifyService from '../../services/spotify';
import { getCountryCode } from '@/lib/utils';
import { DEFAULT_CACHE_TTL, recommendationsCache } from '@/lib/cache';
import { ENABLE_CACHE_DEBUG } from '@/lib/isomorphic-cache';

// Aumento considerable del timeout para las búsquedas de YouTube
const YOUTUBE_SEARCH_TIMEOUT = 15000; // 15 segundos

// Caché en memoria para resultados de búsqueda
interface MemoryCache {
  [key: string]: {
    timestamp: number;
    data: any[];
  }
}

export class SearchService {
  private youtubeMusic: YouTubeMusicAPI;
  private spotify: any;
  private static memoryCache: MemoryCache = {};
  // Tiempo de vida para la caché en memoria (5 minutos)
  private static MEMORY_CACHE_TTL = 5 * 60 * 1000;

  constructor() {
    this.youtubeMusic = new YouTubeMusicAPI();
    this.spotify = SpotifyService;
  }

  async searchMultiSource(query: string, limit: number = 20): Promise<any[]> {
    try {
      // Clave única para la caché
      const cacheKey = `search:${query}:${limit}`;
      
      // Primero verificar la caché en memoria (más rápida)
      const now = Date.now();
      const cached = SearchService.memoryCache[cacheKey];
      if (cached && (now - cached.timestamp < SearchService.MEMORY_CACHE_TTL)) {
        // Solo mostrar log si se habilita el debug
        if (ENABLE_CACHE_DEBUG) {
          console.log(`[SearchService] Usando caché en memoria para "${query}"`);
        }
        return cached.data;
      }
      
      // Luego verificar la caché persistente
      try {
        const cachedData = await recommendationsCache.get(cacheKey);
        if (cachedData) {
          const parsedData = JSON.parse(cachedData);
          // Actualizar también la caché en memoria
          SearchService.memoryCache[cacheKey] = {
            timestamp: now,
            data: parsedData
          };
          
          // Solo mostrar log si se habilita el debug
          if (ENABLE_CACHE_DEBUG) {
            console.log(`[SearchService] Usando caché persistente para "${query}"`);
          }
          return parsedData;
        }
      } catch (cacheError) {
        console.warn(`[SearchService] Error accediendo a caché para "${query}":`, cacheError);
      }
      
      // Región del usuario para búsquedas contextuales
      const region = getCountryCode();
      // Este log se mantiene porque es una búsqueda real a la API
      console.log(`[SearchService] Buscando "${query}" con región: ${region}`);

      // Buscar en paralelo en ambas fuentes
      const [spotifyResults, youtubeMusicResults] = await Promise.allSettled([
        this.searchSpotify(query, limit),
        this.searchYouTubeMusic(query, limit, region)
      ]);

      // Manejar resultados
      let results: any[] = [];

      // Agregar resultados de Spotify
      if (spotifyResults.status === 'fulfilled') {
        results = results.concat(spotifyResults.value || []);
      } else {
        console.error(`[SearchService] Error en búsqueda de Spotify:`, spotifyResults.reason);
      }

      // Agregar resultados de YouTube Music
      if (youtubeMusicResults.status === 'fulfilled') {
        results = results.concat(youtubeMusicResults.value || []);
      } else {
        console.error(`[SearchService] Error en búsqueda de YouTube Music:`, youtubeMusicResults.reason);
      }

      // Remover duplicados (basado en título + artista)
      const uniqueResults = this.removeDuplicates(results);

      // Ordenar resultados por relevancia
      const sortedResults = this.sortByRelevance(uniqueResults, query);
      
      // Limitar al número solicitado
      const finalResults = sortedResults.slice(0, limit);
      
      // Guardar en caché para futuras búsquedas
      if (finalResults.length > 0) {
        // Primero en memoria (acceso más rápido)
        SearchService.memoryCache[cacheKey] = {
          timestamp: now,
          data: finalResults
        };
        
        // Luego en caché persistente
        try {
          await recommendationsCache.set(
            cacheKey,
            JSON.stringify(finalResults),
            DEFAULT_CACHE_TTL
          );
        } catch (cacheError) {
          console.warn(`[SearchService] Error guardando en caché "${query}":`, cacheError);
        }
      }
      
      // Limpieza periódica de la caché en memoria
      this.cleanMemoryCache();

      return finalResults;
    } catch (error) {
      console.error('[SearchService] Error en búsqueda multi-fuente:', error);
      return [];
    }
  }

  /**
   * Limpia periódicamente la caché en memoria para evitar consumo excesivo
   */
  private cleanMemoryCache() {
    const now = Date.now();
    const cacheSize = Object.keys(SearchService.memoryCache).length;
    
    // Si la caché es pequeña, no es necesario limpiarla
    if (cacheSize < 100) return;
    
    // Eliminar entradas expiradas
    let expiredCount = 0;
    for (const key in SearchService.memoryCache) {
      if (now - SearchService.memoryCache[key].timestamp > SearchService.MEMORY_CACHE_TTL) {
        delete SearchService.memoryCache[key];
        expiredCount++;
      }
    }
    
    // Si aún hay demasiadas entradas, eliminar las más antiguas
    const remainingKeys = Object.keys(SearchService.memoryCache);
    if (remainingKeys.length > 100) {
      // Ordenar por timestamp (más antiguo primero)
      const sortedEntries = remainingKeys
        .map(key => ({ key, timestamp: SearchService.memoryCache[key].timestamp }))
        .sort((a, b) => a.timestamp - b.timestamp);
      
      // Eliminar las entradas más antiguas (25% del total)
      const toRemove = Math.ceil(sortedEntries.length * 0.25);
      for (let i = 0; i < toRemove; i++) {
        delete SearchService.memoryCache[sortedEntries[i].key];
      }
      
      // Solo mostrar log si se habilita el debug
      if (ENABLE_CACHE_DEBUG) {
        console.log(`[SearchService] Limpieza de caché: ${expiredCount} expirados, ${toRemove} antiguos eliminados`);
      }
    }
  }

  private async searchSpotify(query: string, limit: number): Promise<any[]> {
    try {
      const results = await this.spotify.searchTracks(query, limit);
      return results.map((item: any) => ({
        ...item,
        source: 'spotify'
      }));
    } catch (error) {
      console.error('[SearchService] Error en búsqueda de Spotify:', error);
      return [];
    }
  }

  private async searchYouTubeMusic(query: string, limit: number, region: string): Promise<any[]> {
    // Implementar un timeout para manejar problemas de conexión con YouTube Music
    return new Promise(async (resolve, reject) => {
      // Timer para abortar si toma demasiado tiempo
      const timeoutId = setTimeout(() => {
        console.warn(`[Search] Timeout para youtube con query "${query}" y región ${region}`);
        resolve([]);
      }, YOUTUBE_SEARCH_TIMEOUT);

      try {
        // Incluir la región en la búsqueda
        const url = `/api/youtube/search?query=${encodeURIComponent(query)}&limit=${limit}&region=${region}`;
        const response = await axios.get(url, {
          timeout: YOUTUBE_SEARCH_TIMEOUT
        });

        // Limpiar el timeout ya que la solicitud se completó
        clearTimeout(timeoutId);

        if (response.data && Array.isArray(response.data)) {
          const results = response.data.map((item: any) => ({
            ...item,
            source: 'youtube'
          }));
          resolve(results);
        } else {
          console.warn('[SearchService] Respuesta inesperada de YouTube:', response.data);
          resolve([]);
        }
      } catch (error) {
        // Limpiar el timeout si hay un error
        clearTimeout(timeoutId);
        
        console.error('[SearchService] Error en búsqueda de YouTube Music:', error);
        // Resolvemos con array vacío en lugar de rechazar para no interrumpir toda la búsqueda
        resolve([]);
      }
    });
  }

  private removeDuplicates(results: any[]): any[] {
    const uniqueMap = new Map();
    
    results.forEach(item => {
      // Crear una clave única basada en el título y artista
      const artistName = item.artists?.[0]?.name || item.artist || 'Unknown';
      const trackName = item.name || item.title || '';
      const key = `${trackName.toLowerCase()}_${artistName.toLowerCase()}`;
      
      // Solo mantener el primer resultado para esta clave
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
      } else {
        // Priorizar resultados de Spotify sobre YouTube si hay duplicados
        const existingItem = uniqueMap.get(key);
        if (existingItem.source === 'youtube' && item.source === 'spotify') {
          uniqueMap.set(key, item);
        }
      }
    });
    
    return Array.from(uniqueMap.values());
  }

  private sortByRelevance(results: any[], query: string): any[] {
    const lowerQuery = query.toLowerCase();
    
    return results.sort((a, b) => {
      const titleA = (a.name || a.title || '').toLowerCase();
      const titleB = (b.name || b.title || '').toLowerCase();
      
      const artistA = (a.artists?.[0]?.name || a.artist || '').toLowerCase();
      const artistB = (b.artists?.[0]?.name || b.artist || '').toLowerCase();
      
      // Calcular relevancia basada en si la consulta está en el título o el artista
      const relevanceA = 
        (titleA.includes(lowerQuery) ? 2 : 0) + 
        (artistA.includes(lowerQuery) ? 1 : 0) +
        (a.source === 'spotify' ? 0.5 : 0); // Ligera preferencia por Spotify
      
      const relevanceB = 
        (titleB.includes(lowerQuery) ? 2 : 0) + 
        (artistB.includes(lowerQuery) ? 1 : 0) +
        (b.source === 'spotify' ? 0.5 : 0);
      
      return relevanceB - relevanceA;
    });
  }
} 