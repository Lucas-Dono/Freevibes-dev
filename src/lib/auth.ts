import { cookies } from 'next/headers';

interface User {
  id: string;
  name: string;
  email?: string;
  image?: string;
}

interface Session {
  user: User | null;
  expires: string;
  accessToken?: string;
  refreshToken?: string;
}

/**
 * Obtiene la sesión actual del usuario desde las cookies
 */
export async function getSession(): Promise<Session | null> {
  try {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get('next-auth.session-token');
    
    if (!sessionCookie?.value) {
      return null;
    }
    
    // En un entorno real, aquí verificaríamos la validez del token
    // Para este ejemplo, creamos un usuario simulado
    const mockUser: User = {
      id: 'user-123',
      name: 'Usuario Ejemplo',
      email: 'usuario@ejemplo.com',
      image: 'https://placehold.co/400x400/blue/white?text=Usuario'
    };
    
    return {
      user: mockUser,
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token'
    };
  } catch (error) {
    console.error('Error al obtener la sesión:', error);
    return null;
  }
}

/**
 * Verifica si el usuario actual está autenticado
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return session !== null && session.user !== null;
} 