import { NextRequest, NextResponse } from 'next/server';
import { API_CONFIG } from '@/config/api-config';

export async function POST(req: NextRequest) {
  try {
    const { username, email, password } = await req.json();

    // Validar que se proporcionen todos los campos requeridos
    if (!username || !email || !password) {
      return NextResponse.json(
        { message: 'Todos los campos son requeridos' },
        { status: 400 }
      );
    }

    // Hacer petición al backend para registrar al usuario - usando NODE_API_URL en lugar de BACKEND_URL
    const response = await fetch(`${API_CONFIG.NODE_API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, email, password }),
    });

    const data = await response.json();

    // Si no fue exitoso, devolver el error
    if (!response.ok) {
      return NextResponse.json(
        { message: data.message || 'Error al registrar usuario' },
        { status: response.status }
      );
    }

    // Devolver la respuesta exitosa
    return NextResponse.json(data, { status: 201 });

  } catch (error) {
    console.error('Error en registro:', error);
    return NextResponse.json(
      { message: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
