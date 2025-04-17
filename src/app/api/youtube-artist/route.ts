import { NextResponse } from 'next/server';
import axios from 'axios';
import { API_TIMEOUTS } from '@/lib/constants';

// Configuración para indicar que esta ruta es dinámica
export const dynamic = 'force-dynamic';

/**
 * Endpoint proxy para el servidor Python que maneja las solicitudes a /api/youtube-artist
 */
export async function GET(request: Request) {
  try {
    // Obtener los parámetros de la consulta
    const { searchParams } = new URL(request.url);
    const artistId = searchParams.get('artistId');
    
    if (!artistId) {
      return NextResponse.json(
        { error: 'Se requiere el parámetro artistId' },
        { status: 400 }
      );
    }
    
    // URL del servidor Python (puerto 5000 según .env)
    const pythonServerUrl = process.env.NEXT_PUBLIC_PYTHON_API_URL || 'http://localhost:5000';
    
    // URL completa para la solicitud
    const fullUrl = `${pythonServerUrl}/api/youtube-artist?artistId=${artistId}`;
    
    // Llamar a la API de Python para obtener los detalles del artista
    const response = await axios.get(fullUrl, {
      timeout: API_TIMEOUTS?.DETAILS || 15000 // Usar un timeout adecuado para detalles
    });
    
    // Si la respuesta es exitosa, devolver los datos
    return NextResponse.json(response.data);
  } catch (error) {
    console.error('[API Proxy] Error al obtener información del artista:', error);
    
    // Si es un error de respuesta HTTP, intentar extraer detalles y mostrar información más detallada
    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status || 500;
      const responseData = error.response?.data || {};
      const errorMessage = error.message || 'Error desconocido';
      
      console.error(`[API Proxy] Detalles del error: Status=${statusCode}, Mensaje=${errorMessage}`);
      
      return NextResponse.json(
        { 
          error: `Error al obtener información del artista: ${statusCode}`,
          details: responseData,
          message: errorMessage
        },
        { status: statusCode }
      );
    }
    
    // Otros errores
    return NextResponse.json(
      { error: 'Error al obtener información del artista' },
      { status: 500 }
    );
  }
} 