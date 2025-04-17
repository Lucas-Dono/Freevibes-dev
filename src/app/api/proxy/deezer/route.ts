import { NextRequest, NextResponse } from 'next/server';
import { API_CONFIG } from '@/config/api-config';

const API_URL = API_CONFIG.DEEZER_API_BASE;

/**
 * Proxy para solicitudes a la API de Deezer
 * Permite evitar problemas CORS
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Extraer los parámetros de la solicitud original
    const endpoint = searchParams.get('endpoint') || 'search';
    const query = searchParams.get('q');
    const limit = searchParams.get('limit') || '30';
    
    // Validar parámetros requeridos para búsqueda
    if (endpoint === 'search' && !query) {
      return NextResponse.json({ error: 'Parámetro de búsqueda (q) requerido' }, { status: 400 });
    }
    
    // Construir URL para Deezer
    let deezerUrl = `${API_URL}/${endpoint}`;
    
    // Añadir parámetros según el endpoint
    const urlParams = new URLSearchParams();
    
    if (query) urlParams.append('q', query);
    if (limit) urlParams.append('limit', limit);
    
    // Añadir otros parámetros que vengan en la solicitud original
    // Convertir searchParams a un array iterable
    const searchParamsEntries = Array.from(searchParams.entries());
    for (const [key, value] of searchParamsEntries) {
      if (!['endpoint', 'q', 'limit'].includes(key)) {
        urlParams.append(key, value);
      }
    }
    
    // Añadir los parámetros a la URL
    const paramString = urlParams.toString();
    if (paramString) {
      deezerUrl += `?${paramString}`;
    }
    
    
    // Establecer un tiempo de espera para la solicitud (7 segundos)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);
    
    // Realizar la solicitud a Deezer
    const response = await fetch(deezerUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'freevibes/1.0'
      }
    });
    
    clearTimeout(timeoutId);
    
    // Obtener los datos de respuesta
    if (!response.ok) {
      console.error(`[Proxy] Error de Deezer: ${response.status} - ${response.statusText}`);
      return NextResponse.json(
        { error: `Deezer API error: ${response.status}` }, 
        { status: response.status }
      );
    }
    
    const data = await response.json();
    
    // Devolver respuesta con control de caché
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=3600', // Cache por 1 hora
        'Access-Control-Allow-Origin': '*' // Permitir CORS
      }
    });
  } catch (error) {
    console.error('[Proxy] Error al procesar solicitud Deezer:', error);
    
    // Determinar tipo de error para devolver respuesta apropiada
    if (error instanceof TypeError && error.name === 'AbortError') {
      return NextResponse.json({ error: 'Timeout al conectar con Deezer' }, { status: 504 });
    }
    
    return NextResponse.json(
      { error: 'Error al procesar la solicitud a Deezer' }, 
      { status: 500 }
    );
  }
} 