import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Garantizar que la ruta sea dinámica para que Next.js no la construya estáticamente
export const dynamic = 'force-dynamic';

// Ruta base para los archivos de datos demo
const DEMO_DATA_BASE_PATH = process.cwd() + '/node-server/demo-data/spotify';

// Comprobar si el modo demo está habilitado y los datos están disponibles
async function checkDemoAvailability() {
  try {
    // Comprobar si existe el directorio de datos demo
    const demoDir = path.join(process.cwd(), 'node-server', 'demo-data');
    await fs.access(demoDir);

    // Comprobar si existen archivos esenciales
    const spotifyDir = path.join(demoDir, 'spotify');
    await fs.access(spotifyDir);

    // Verificar al menos un archivo de recomendaciones
    const recsFile = path.join(spotifyDir, 'recommendations.json');
    const recsMultiFile = path.join(spotifyDir, 'recommendations_multilanguage.json');

    try {
      await fs.access(recsFile);
    } catch (error) {
      try {
        await fs.access(recsMultiFile);
      } catch (error) {
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Error al verificar disponibilidad del modo demo:', error);
    return false;
  }
}

/**
 * Endpoint para verificar si los datos demo están disponibles
 */
export async function GET() {
  try {
    const available = await checkDemoAvailability();

    return NextResponse.json({
      available,
      mode: process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ? 'active' : 'disabled',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error en API route demo/status:', error);
    return NextResponse.json({
      available: false,
      error: 'Error al verificar estado del modo demo',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
