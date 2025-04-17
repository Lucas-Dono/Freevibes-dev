import { NextRequest, NextResponse } from 'next/server';
import { API_CONFIG } from '@/config/api-config';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    
    // Validar que se proporcionen email y password
    if (!email || !password) {
      return NextResponse.json(
        { message: 'Correo electrónico y contraseña son requeridos' },
        { status: 400 }
      );
    }

    // Hacer petición al backend para autenticar - usando NODE_API_URL en lugar de BACKEND_URL
    const response = await fetch(`${API_CONFIG.NODE_API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    // Si no fue exitoso, devolver el error
    if (!response.ok) {
      return NextResponse.json(
        { message: data.message || 'Error de autenticación' },
        { status: response.status }
      );
    }

    // Devolver el token y otros datos relevantes
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Error en login:', error);
    return NextResponse.json(
      { message: 'Error interno del servidor' },
      { status: 500 }
    );
  }
} 