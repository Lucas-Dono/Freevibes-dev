/**
 * Endpoint de autenticación para Last.fm
 * Maneja la redirección y autorización para Last.fm API
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import MD5 from 'crypto-js/md5';

// Configuración de Last.fm 
const API_KEY = process.env.LASTFM_API_KEY || '';
const SHARED_SECRET = process.env.LASTFM_SHARED_SECRET || '';
const REDIRECT_URI = process.env.LASTFM_REDIRECT_URI || 'http://localhost:3000/api/auth/lastfm/callback';

/**
 * Ruta GET para manejar el callback de autenticación de Last.fm
 */
export async function GET(request: NextRequest) {
  try {
    // Obtener parámetros de la URL
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');
    
    // Verificar si recibimos un token
    if (!token) {
      console.error('Error: No se recibió token de Last.fm');
      return NextResponse.redirect(new URL('/error?message=No_se_recibió_token_de_Last.fm', request.url));
    }
    
    // En Last.fm, debemos intercambiar el token por una sesión
    const sessionResponse = await getLastfmSession(token);
    
    if (!sessionResponse.success) {
      console.error('Error obteniendo la sesión de Last.fm:', sessionResponse.error);
      return NextResponse.redirect(new URL(`/error?message=${encodeURIComponent(sessionResponse.error || 'Error al obtener sesión')}`, request.url));
    }
    
    // Guardar la sesión en cookies
    const cookieStore = cookies();
    
    if (sessionResponse.sessionKey) {
      cookieStore.set('lastfm_session_key', sessionResponse.sessionKey, {
        maxAge: 60 * 60 * 24 * 30, // 30 días
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
      });
    }
    
    if (sessionResponse.username) {
      cookieStore.set('lastfm_username', sessionResponse.username, {
        maxAge: 60 * 60 * 24 * 30, // 30 días
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
      });
    }
    
    // Redirigir al usuario a la página principal
    return NextResponse.redirect(new URL('/', request.url));
  } catch (error) {
    console.error('Error en el callback de Last.fm:', error);
    return NextResponse.redirect(new URL('/error?message=Error_en_autenticación_con_Last.fm', request.url));
  }
}

/**
 * Obtiene una sesión de Last.fm usando el token de autorización
 * @param token Token de autorización de Last.fm
 * @returns Objeto con información de la sesión o error
 */
async function getLastfmSession(token: string): Promise<{
  success: boolean;
  sessionKey?: string;
  username?: string;
  error?: string;
}> {
  try {
    // Crear firma para la solicitud
    const apiSig = generateApiSignature({
      api_key: API_KEY,
      method: 'auth.getSession',
      token: token
    });
    
    // Endpoint para obtener la sesión
    const endpoint = `https://ws.audioscrobbler.com/2.0/?method=auth.getSession&api_key=${API_KEY}&token=${token}&api_sig=${apiSig}&format=json`;
    
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      return {
        success: false,
        error: `Error de Last.fm: ${response.status} - ${errorData}`
      };
    }
    
    const data = await response.json();
    
    // Verificar si hay sesión en la respuesta
    if (!data.session || !data.session.key) {
      return {
        success: false,
        error: 'Respuesta de Last.fm no contiene datos de sesión'
      };
    }
    
    // Devolver datos de la sesión
    return {
      success: true,
      sessionKey: data.session.key,
      username: data.session.name
    };
  } catch (error) {
    console.error('Error obteniendo sesión de Last.fm:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

/**
 * Genera la firma de la API de Last.fm
 * @param params Parámetros para incluir en la firma
 * @returns Firma MD5 para la solicitud
 */
function generateApiSignature(params: Record<string, string>): string {
  // Ordenar parámetros alfabéticamente por nombre
  const sortedParams = Object.keys(params).sort().reduce<Record<string, string>>((acc, key) => {
    acc[key] = params[key];
    return acc;
  }, {});
  
  // Crear cadena para la firma
  let signatureString = '';
  for (const [key, value] of Object.entries(sortedParams)) {
    signatureString += key + value;
  }
  
  // Añadir la clave secreta compartida
  signatureString += SHARED_SECRET;
  
  // Generar hash MD5 usando crypto-js
  return MD5(signatureString).toString();
} 