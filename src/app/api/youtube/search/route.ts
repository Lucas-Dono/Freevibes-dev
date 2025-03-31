import { NextRequest, NextResponse } from 'next/server';
import { youtube } from '@/services/youtube';

export async function GET(request: NextRequest) {
  try {
    // Obtener los parámetros de búsqueda
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '1', 10);
    
    if (!query) {
      return NextResponse.json(
        { error: 'Se requiere un parámetro de búsqueda "q"' },
        { status: 400 }
      );
    }
    
    console.log(`[YouTube Search API] Buscando: "${query}"`);
    
    // Realizar la búsqueda en YouTube
    const searchResults = await youtube.search(query, limit);
    
    // Si no hay resultados, devolver un error
    if (!searchResults || !searchResults.items || searchResults.items.length === 0) {
      console.log(`[YouTube Search API] No se encontraron resultados para: "${query}"`);
      return NextResponse.json(
        { error: 'No se encontraron resultados', query },
        { status: 404 }
      );
    }
    
    console.log(`[YouTube Search API] Encontrados ${searchResults.items.length} resultados para: "${query}"`);
    
    // Devolver los resultados
    return NextResponse.json(searchResults);
  } catch (error: any) {
    console.error(`[YouTube Search API] Error:`, error);
    
    // Detectar si es un error específico de límite de cuota
    const isQuotaError = error.message?.includes('quota') || 
                         error.message?.includes('Quota limit reached') || 
                         error.message?.includes('quotaExceeded');
    
    if (isQuotaError) {
      console.warn(`[YouTube Search API] Límite de cuota alcanzado para: "${request.nextUrl.searchParams.get('q')}"`);
      
      return NextResponse.json(
        { 
          error: 'Quota limit reached for YouTube API',
          details: 'El límite diario de la API de YouTube se ha alcanzado. Por favor, intenta más tarde.',
          isQuotaError: true,
          query: request.nextUrl.searchParams.get('q')
        },
        { status: 429 } // 429 = Too Many Requests
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Error al buscar en YouTube', 
        details: error.message,
        query: request.nextUrl.searchParams.get('q')
      },
      { status: 500 }
    );
  }
} 