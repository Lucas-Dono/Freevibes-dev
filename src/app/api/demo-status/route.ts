import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  
  // Forzar que el modo demo esté disponible siempre
  return NextResponse.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    demoReady: true,
    message: 'El sistema está listo para el modo demo'
  });
} 