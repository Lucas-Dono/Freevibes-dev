import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { upsertUserWithSpotifyInfo } from '@/lib/db/services/userService';

// Esta función probablemente no será necesaria ya que NextAuth manejará el callback
// Pero la mantenemos por si hay alguna lógica personalizada necesaria
export async function GET(request: NextRequest) {
  
  // Redirigir al usuario a la página de inicio
  return NextResponse.redirect(new URL('/home', request.url));
} 