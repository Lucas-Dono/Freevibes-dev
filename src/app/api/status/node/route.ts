import { NextRequest, NextResponse } from 'next/server';
import axios, { AxiosError } from 'axios';
import { API_CONFIG } from '@/config/api-config';

export async function GET(request: NextRequest) {
  try {
    // Obtener URL del servidor Node directamente de la variable de entorno
    // para evitar problemas de caché o fallbacks incorrectos
    const nodeServerUrl = process.env.NEXT_PUBLIC_NODE_API_URL || 'http://localhost:3001';
    console.log('[API Status Node] Usando URL:', nodeServerUrl);

    // Intentar verificar el estado del servidor con un timeout menor
    const response = await axios.get(`${nodeServerUrl}/status`, {
      timeout: 3000
    });

    // Comprobar si la respuesta es válida
    // Consideramos que cualquier respuesta 200 indica que el servidor está activo
    // incluso si el formato no es exactamente el esperado
    const isActive = response.status === 200;

    console.log('[API Status Node] Estado del servidor:', isActive ? 'Activo' : 'Inactivo',
                'Status Code:', response.status,
                'Response:', JSON.stringify(response.data).substring(0, 100));

    return NextResponse.json({
      active: isActive,
      timestamp: new Date().toISOString(),
      details: {
        status: response.status,
        data: response.data
      }
    });
  } catch (error: unknown) {
    // Manejar el error con tipado correcto
    const errorMessage = error instanceof AxiosError
      ? error.code || error.message
      : 'Error desconocido';

    console.error('[API Status Node] Error al verificar servidor Node:', errorMessage);

    return NextResponse.json({
      active: false,
      timestamp: new Date().toISOString(),
      error: errorMessage
    });
  }
}
