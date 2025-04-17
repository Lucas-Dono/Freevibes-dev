export class CircuitBreaker {
  private fallos = 0;
  private ultimoFallo = 0;
  private estado: 'CERRADO' | 'ABIERTO' | 'SEMI_ABIERTO' = 'CERRADO';
  
  constructor(
    private umbralFallos = 3,
    private tiempoReinicio = 30000
  ) {}
  
  async ejecutar<T>(primaryFn: () => Promise<T>, fallbackFn?: () => Promise<T>): Promise<T> {
    if (this.estado === 'ABIERTO') {
      if (Date.now() - this.ultimoFallo > this.tiempoReinicio) {
        this.estado = 'SEMI_ABIERTO';
      } else {
        return fallbackFn ? fallbackFn() : Promise.reject(new Error('Circuito abierto y no hay fallback'));
      }
    }
    
    try {
      const resultado = await primaryFn();
      this.exito();
      return resultado;
    } catch (error) {
      this.fallo();
      console.warn(`CircuitBreaker: error (${this.fallos}/${this.umbralFallos}). Estado: ${this.estado}`);
      
      if (fallbackFn) {
        try {
          return await fallbackFn();
        } catch (fallbackError) {
          console.error('CircuitBreaker: también falló el fallback', fallbackError);
          throw fallbackError;
        }
      }
      
      throw error;
    }
  }
  
  private exito(): void {
    if (this.estado === 'SEMI_ABIERTO') {
    }
    
    this.fallos = 0;
    this.estado = 'CERRADO';
  }
  
  private fallo(): void {
    this.fallos++;
    this.ultimoFallo = Date.now();
    
    if (this.fallos >= this.umbralFallos || this.estado === 'SEMI_ABIERTO') {
      this.estado = 'ABIERTO';
    }
  }
} 