import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env.mjs";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const country = searchParams.get('country') || 'ES';

    const nodeServerUrl = env.NODE_SERVER_URL || process.env.NEXT_PUBLIC_NODE_SERVER_URL || 'http://localhost:3001';
    const endpoint = `/api/youtube/get-charts?country=${encodeURIComponent(country)}`;
    const url = `${nodeServerUrl}${endpoint}`;

    console.log(`[API] Obteniendo charts desde: ${url}`);

    const response = await fetch(url);

    // Verificar si el tipo de contenido es texto/html
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      console.error(`[API] El servidor devolvió HTML en lugar de JSON. URL: ${url}`);
      return NextResponse.json({
        error: 'El servidor devolvió un formato incorrecto. Verifica que el servidor Node esté disponible.'
      }, { status: 500 });
    }

    if (!response.ok) {
      console.error(`[API] Error en get-charts: ${response.status} ${response.statusText}`);
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { message: await response.text().then(text =>
          text.length > 100 ? text.substring(0, 100) + '...' : text
        )};
      }

      return NextResponse.json({
        error: errorData.message || 'Error obteniendo listas de éxitos',
        status: response.status
      }, { status: response.status });
    }

    const textData = await response.text();
    let data;

    try {
      data = JSON.parse(textData);
    } catch (error) {
      console.error('[API] Error al parsear JSON en get-charts:', error);
      console.error('[API] Respuesta recibida:', textData.substring(0, 200) + '...');
      return NextResponse.json({
        error: 'Error al procesar la respuesta del servidor',
        details: textData.length > 100 ? textData.substring(0, 100) + '...' : textData
      }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error en API route get-charts:', error);
    return NextResponse.json({
      error: 'Error al obtener listas de éxitos',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
