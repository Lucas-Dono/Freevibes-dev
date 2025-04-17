/**
 * Proxy para la API de YouTube Music
 * 
 * Este endpoint redirige las solicitudes al servicio Python que gestiona
 * la API no oficial de YouTube Music.
 */
import { NextRequest, NextResponse } from 'next/server';
import { API_CONFIG } from '@/config/api-config';

// URL del servidor Python de YouTube Music
const YTMUSIC_SERVICE_URL = API_CONFIG.getPythonApiUrl();

export async function GET(request: NextRequest) {
  try {
    // Obtener la ruta que viene después de /api/youtube
    const pathname = request.nextUrl.pathname;
    const endpoint = pathname.replace('/api/youtube', '');
    
    // Construir la URL para redirigir al servicio Python
    const targetUrl = new URL(`${YTMUSIC_SERVICE_URL}${endpoint || ''}`, YTMUSIC_SERVICE_URL);
    
    // Copiar todos los parámetros de consulta
    request.nextUrl.searchParams.forEach((value, key) => {
      targetUrl.searchParams.append(key, value);
    });
    
    
    // Realizar la solicitud al servicio Python
    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    // Verificar si la respuesta fue exitosa
    if (!response.ok) {
      console.error(`[YouTube Music Proxy] Error HTTP ${response.status}: ${response.statusText}`);
      
      let errorMessage = `Error en el servicio de YouTube Music: ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        // Si no se puede parsear la respuesta como JSON, usar el mensaje de error genérico
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }
    
    // Devolver la respuesta del servicio Python
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[YouTube Music Proxy] Error:', error);
    
    return NextResponse.json(
      { error: 'Error en el proxy de YouTube Music', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Obtener la ruta que viene después de /api/youtube
    const pathname = request.nextUrl.pathname;
    const endpoint = pathname.replace('/api/youtube', '');
    
    // Construir la URL para redirigir al servicio Python
    const targetUrl = new URL(`${YTMUSIC_SERVICE_URL}${endpoint || ''}`, YTMUSIC_SERVICE_URL);
    
    // Obtener el cuerpo de la solicitud
    const body = await request.json();
    
    
    // Realizar la solicitud al servicio Python
    const response = await fetch(targetUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(body)
    });
    
    // Verificar si la respuesta fue exitosa
    if (!response.ok) {
      console.error(`[YouTube Music Proxy] Error HTTP ${response.status}: ${response.statusText}`);
      
      let errorMessage = `Error en el servicio de YouTube Music: ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        // Si no se puede parsear la respuesta como JSON, usar el mensaje de error genérico
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }
    
    // Devolver la respuesta del servicio Python
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[YouTube Music Proxy] Error en POST:', error);
    
    return NextResponse.json(
      { error: 'Error en el proxy de YouTube Music', details: error.message },
      { status: 500 }
    );
  }
} 