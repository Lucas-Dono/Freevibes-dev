import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getSession } from '@/lib/auth';

// Marcar esta ruta explícitamente como dinámica para evitar errores de compilación estática
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session || !session.user) {
      return NextResponse.json(
        { 
          authenticated: false, 
          message: 'No autenticado' 
        },
        { status: 401 }
      );
    }
    
    // Devuelve información del usuario autenticado
    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image
      }
    });
    
  } catch (error) {
    console.error('Error al obtener información del usuario:', error);
    return NextResponse.json(
      { 
        error: 'Error al obtener información del usuario',
        details: (error as Error).message 
      },
      { status: 500 }
    );
  }
} 