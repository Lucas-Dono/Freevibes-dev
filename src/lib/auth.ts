import { NextAuthOptions } from "next-auth";
import SpotifyProvider from "next-auth/providers/spotify";
import { cookies } from "next/headers";

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

// Constante para el nombre de la cookie de modo demo
export const DEMO_MODE_COOKIE = 'demoMode';

// Configuración de NextAuth
export const authOptions: NextAuthOptions = {
  providers: [
    SpotifyProvider({
      clientId: process.env.SPOTIFY_CLIENT_ID || "",
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET || "",
      authorization: {
        params: {
          scope: "user-read-email user-read-private user-top-read user-library-read playlist-read-private playlist-read-collaborative user-follow-read",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      console.log('[NextAuth] Generando JWT:', { tokenSub: token?.sub });
      
      // Si tenemos información de la cuenta, anexarla al token
      if (account) {
        console.log('[NextAuth] Datos de cuenta recibidos:', { 
          provider: account.provider,
          accessTokenExpiresIn: account.expires_in
        });
        
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at ? account.expires_at * 1000 : 0;
      }
      
      // Verificar si el token ha expirado
      if (token.accessTokenExpires && Date.now() > token.accessTokenExpires) {
        console.log('[NextAuth] Token expirado, intentando refrescar');
        // Lógica para refrescar el token...
      }
      
      return token;
    },
    
    async session({ session, token, user }) {
      console.log('[NextAuth] Creando sesión:', { 
        sessionUser: session?.user?.name,
        tokenSub: token?.sub,
        isDemoMode: isInDemoMode()
      });
      
      // Asegurar que no estamos en modo demo antes de devolver la sesión real
      if (typeof window !== 'undefined' && window.__FORCE_DISABLE_DEMO__) {
        console.log('[NextAuth] Forzando desactivación del modo demo en la sesión');
        // Limpiar cookies de demo
        document.cookie = 'demoMode=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      }
      
      // Agregar el token de acceso a la sesión
      if (token) {
        session.accessToken = token.accessToken;
        session.refreshToken = token.refreshToken;
        session.error = token.error;
      }
      
      return session;
    }
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 días
  },
  pages: {
    signIn: "/login",
    signOut: "/login", 
    error: "/login",
  },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  debug: process.env.NODE_ENV === "development",
};

// Función para comprobar si estamos en modo demo
export const isInDemoMode = (): boolean => {
  // Si estamos en el cliente, podemos verificar si el modo demo ha sido desactivado
  if (typeof window !== 'undefined' && window.__FORCE_DISABLE_DEMO__) {
    return false;
  }

  // Verificar el valor de la cookie usando cookies() de next/headers
  try {
    const cookieStore = cookies();
    return cookieStore.get(DEMO_MODE_COOKIE)?.value === 'true';
  } catch (error) {
    // Si hay un error al acceder a las cookies (por ejemplo, en el lado del cliente)
    return false;
  }
};

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