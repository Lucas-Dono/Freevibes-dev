'use client';

import { useContext } from 'react';
import { AuthContext as ComponentAuthContext, defaultAuthContext as componentDefaultAuth } from '@/components/providers/AuthProvider';
import { AuthContext as LibAuthContext } from '@/lib/auth/AuthProvider';

// Interfaz que combina ambos tipos de contexto de autenticación
interface CommonAuthProps {
  isAuthenticated?: boolean;
  isLoading?: boolean;
  loading?: boolean;
  user?: any;
  isDemo?: boolean;
}

/**
 * Hook para acceder al contexto de autenticación
 * Soporta tanto el AuthProvider de components como el de lib/auth
 */
export function useAuth(): CommonAuthProps {
  // Intentar usar el AuthContext más reciente (el de components)
  const componentAuth = useContext(ComponentAuthContext);
  
  // Si existe, devolverlo
  if (componentAuth !== componentDefaultAuth) {
    return componentAuth;
  }
  
  // En caso contrario, intentar usar el AuthContext legacy
  try {
    const libAuth = useContext(LibAuthContext);
    
    if (libAuth) {
      // Mapear las propiedades del contexto legacy a las propiedades comunes
      return {
        isAuthenticated: !!libAuth.user,
        isLoading: libAuth.loading,
        loading: libAuth.loading,
        user: libAuth.user
      };
    }
  } catch (error) {
    // Si hay error, simplemente ignorarlo
  }
  
  // Devolver un objeto con valores por defecto
  return {
    isAuthenticated: false,
    isLoading: true,
    loading: true,
    isDemo: false
  };
} 