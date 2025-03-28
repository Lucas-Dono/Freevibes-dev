import { recommendationsCache } from './cache';

// Tipos de fuentes disponibles
export type SourceType = 'spotify' | 'deezer' | 'lastfm' | 'youtube';

// Información de estado de cada fuente
interface SourceStatus {
  available: boolean;
  errorCount: number;
  lastError?: number;
  successCount: number;
  lastSuccess?: number;
  lastAttempt?: number;
  priority: number;
}

// Clave para guardar el estado en el caché
const SOURCE_MANAGER_CACHE_KEY = 'source_manager_state';

// Implementación del gestor de fuentes
class SourceManager {
  private sources: Record<SourceType, SourceStatus> = {
    spotify: { available: true, errorCount: 0, successCount: 0, priority: 1 },
    lastfm: { available: true, errorCount: 0, successCount: 0, priority: 2 },
    deezer: { available: true, errorCount: 0, successCount: 0, priority: 3 },
    youtube: { available: true, errorCount: 0, successCount: 0, priority: 4 }
  };

  private static instance: SourceManager;

  private constructor() {
    // Inicialización asíncrona, pero lo manejamos como síncrono
    // ya que el caché es asíncrono pero la mayoría de operaciones lo usan sincrónicamente
    this.loadState();
  }

  public static getInstance(): SourceManager {
    if (!SourceManager.instance) {
      SourceManager.instance = new SourceManager();
    }
    return SourceManager.instance;
  }

  // Inicializar el estado desde el caché
  private async loadState(): Promise<void> {
    try {
      const cachedState = await recommendationsCache.get(SOURCE_MANAGER_CACHE_KEY);
      if (cachedState) {
        const parsed = JSON.parse(cachedState);
        if (parsed && typeof parsed === 'object') {
          this.sources = parsed;
        }
      }
    } catch (e) {
      console.error('Error al cargar el estado del SourceManager:', e);
    }
  }

  // Registrar un éxito en una fuente
  public registerSourceSuccess(source: SourceType): void {
    const now = Date.now();
    
    if (this.sources[source]) {
      this.sources[source].available = true;
      this.sources[source].successCount = (this.sources[source].successCount || 0) + 1;
      this.sources[source].lastSuccess = now;
      this.sources[source].lastAttempt = now;
      
      // Si ha tenido éxito después de muchos errores, reducimos el contador de errores
      if (this.sources[source].errorCount > 0) {
        this.sources[source].errorCount = Math.max(0, this.sources[source].errorCount - 1);
      }
      
      this.saveState();
    }
  }

  // Registrar un error en una fuente
  public registerSourceError(source: SourceType): void {
    const now = Date.now();
    
    if (this.sources[source]) {
      this.sources[source].errorCount = (this.sources[source].errorCount || 0) + 1;
      this.sources[source].lastError = now;
      this.sources[source].lastAttempt = now;
      
      // Si acumula más de 5 errores, la marcamos como no disponible temporalmente
      if (this.sources[source].errorCount > 5) {
        this.sources[source].available = false;
      }
      
      this.saveState();
    }
  }

  // Obtener la mejor fuente disponible según prioridad y disponibilidad
  public async getBestSource(): Promise<SourceType> {
    // Obtener fuentes disponibles ordenadas por prioridad
    const availableSources = Object.entries(this.sources)
      .filter(([_, status]) => status.available)
      .sort(([_, statusA], [__, statusB]) => statusA.priority - statusB.priority);
    
    if (availableSources.length === 0) {
      // Si ninguna fuente está disponible, reiniciamos todas y devolvemos la de mayor prioridad
      this.resetAllSources();
      const bestSource = Object.entries(this.sources)
        .sort(([_, statusA], [__, statusB]) => statusA.priority - statusB.priority)[0][0] as SourceType;
      
      return bestSource;
    }
    
    const bestSource = availableSources[0][0] as SourceType;
    return bestSource;
  }

  // Reiniciar todas las fuentes
  public resetAllSources(): void {
    Object.keys(this.sources).forEach(source => {
      this.sources[source as SourceType].available = true;
      this.sources[source as SourceType].errorCount = 0;
    });
    
    this.saveState();
  }

  // Verificar si una fuente está disponible
  public isSourceAvailable(source: SourceType): boolean {
    return this.sources[source]?.available || false;
  }

  // Obtener estado completo de todas las fuentes
  public getAllSourcesStatus(): Record<SourceType, SourceStatus> {
    return { ...this.sources };
  }

  // Guardar el estado actual en el caché
  private saveState(): void {
    try {
      recommendationsCache.set(SOURCE_MANAGER_CACHE_KEY, JSON.stringify(this.sources));
    } catch (e) {
      console.error('Error al guardar el estado del SourceManager:', e);
    }
  }
}

// Función auxiliar para exportar la instancia singleton
export function getSourceManager(): SourceManager {
  return SourceManager.getInstance();
} 