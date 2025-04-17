import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { API_TIMEOUTS } from '@/lib/constants';

// Configuración para indicar que esta ruta es dinámica
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Obtener parámetros de la URL
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('query');
  const filter = searchParams.get('filter') || 'songs';
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  
  // Obtener la clave API si se proporciona (prioridad para reproducción)
  const apiKey = searchParams.get('api_key') || request.headers.get('X-Youtube-Api-Key') || null;

  if (!query) {
    return NextResponse.json(
      { error: 'Se requiere un parámetro de búsqueda' },
      { status: 400 }
    );
  }

  console.log(`[API] Realizando búsqueda de YouTube Music: "${query}" (filtro: ${filter}, límite: ${limit})`);

  try {
    // URL del servidor Python (leída desde la variable de entorno correcta)
    const pythonServerUrl = process.env.NEXT_PUBLIC_PYTHON_API_URL || 'http://localhost:5100';
    
    // URL completa para la solicitud
    let fullUrl = `${pythonServerUrl}/search?query=${encodeURIComponent(query)}&filter=${filter}&limit=${limit}`;
    
    // Incluir la clave API si existe
    if (apiKey) {
      fullUrl += `&api_key=${encodeURIComponent(apiKey)}`;
      console.log(`[API] Usando clave API específica para búsqueda de reproducción`);
    }
    
    console.log(`[API] Solicitando búsqueda a: ${fullUrl}`);
    
    // Llamar directamente a la API de Python para la búsqueda
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'MusicPlayer/1.0'
    };
    
    // Agregar la clave a los headers también para compatibilidad
    if (apiKey) {
      headers['X-Youtube-Api-Key'] = apiKey;
    }
    
    const response = await axios.get(fullUrl, {
      headers,
      timeout: API_TIMEOUTS?.DETAILS || 15000
    });

    console.log(`[API] Respuesta exitosa del servidor Python para búsqueda de "${query}"`);
    
    // Obtener los datos de la respuesta
    const rawData = response.data;
    
    // Normalizar la respuesta para asegurar que siempre sea un array
    let normalizedData = [];
    
    if (Array.isArray(rawData)) {
      // Si ya es un array, usarlo directamente
      normalizedData = rawData;
    } else if (rawData && typeof rawData === 'object') {
      // Si es un objeto pero no un array
      if (rawData.results && Array.isArray(rawData.results)) {
        // Si tiene una propiedad 'results' que es un array
        normalizedData = rawData.results;
        console.log(`[API] Extrayendo datos de la propiedad 'results'`);
      } else if (rawData.artists && Array.isArray(rawData.artists)) {
        // Si tiene una propiedad 'artists' que es un array
        normalizedData = rawData.artists;
        console.log(`[API] Extrayendo datos de la propiedad 'artists'`);
      } else if (rawData.content && Array.isArray(rawData.content)) {
        // Si tiene una propiedad 'content' que es un array
        normalizedData = rawData.content;
        console.log(`[API] Extrayendo datos de la propiedad 'content'`);
      } else if (rawData.items && Array.isArray(rawData.items)) {
        // Si tiene una propiedad 'items' que es un array
        normalizedData = rawData.items;
        console.log(`[API] Extrayendo datos de la propiedad 'items'`);
      } else if (rawData.error) {
        // Si es un objeto de error
        console.error(`[API] Error en la respuesta:`, rawData.error);
        throw new Error(rawData.error);
      } else {
        // Último recurso: convertir el objeto en un array de un solo elemento
        // si tiene propiedades que podrían indicar que es un artista
        if (rawData.browseId || rawData.title || rawData.name) {
          normalizedData = [rawData];
          console.log(`[API] Convirtiendo objeto único a array`);
        } else {
          console.warn(`[API] No se pudo normalizar la respuesta:`, rawData);
        }
      }
    }
    
    // Log detallado para depuración
    if (filter === 'artists') {
      console.log(`[API] Búsqueda de artistas completada. Resultados normalizados: ${normalizedData.length}`);
      normalizedData.forEach((artist: any, index: number) => {
        console.log(`[API] Resultado normalizado #${index + 1}:`, {
          title: artist.title || artist.name,
          browseId: artist.browseId,
          type: artist.type,
          thumbnails: artist.thumbnails ? artist.thumbnails.length : 0
        });
      });
    } else {
      console.log(`[API] Búsqueda completada. Resultados normalizados: ${normalizedData.length}`);
    }

    // Retornar los datos normalizados
    return NextResponse.json(normalizedData);
  } catch (error) {
    console.error(`[API] Error al buscar en YouTube Music: "${query}":`, error);
    
    // Información de error más detallada para depuración
    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status || 500;
      const responseData = error.response?.data || {};
      const errorMessage = error.message || 'Error desconocido';
      
      console.error(`[API] Detalles del error: Status=${statusCode}, Mensaje=${errorMessage}, Datos=${JSON.stringify(responseData)}`);
    }
    
    // Retornar un array vacío con información de error
    return NextResponse.json(
      [],
      { status: 200 } // Devolver 200 pero con array vacío para evitar problemas
    );
  }
} 