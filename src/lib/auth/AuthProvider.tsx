import React, { createContext, useState, useEffect } from 'react';

interface User {
  id: string;
  name?: string;
  email: string;
  image?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar usuario desde localStorage al inicio
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (err) {
        console.error('Error al cargar usuario desde localStorage:', err);
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);

      // En una app real, aquí haríamos una llamada a la API
      // Por ahora, simulamos un login exitoso con datos de ejemplo
      const mockUser: User = {
        id: '123',
        name: 'Usuario de Prueba',
        email: email,
      };

      // Guardar en localStorage para persistencia
      localStorage.setItem('user', JSON.stringify(mockUser));
      setUser(mockUser);
    } catch (err) {
      setError('Error al iniciar sesión. Por favor, inténtalo de nuevo.');
      console.error('Error de login:', err);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      // En una app real, aquí haríamos una llamada a la API para logout

      // Limpiar datos locales
      localStorage.removeItem('user');
      localStorage.removeItem('spotify_token');
      setUser(null);
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
    } finally {
      setLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);

      // En una app real, aquí haríamos una llamada a la API para registro
      // Por ahora, simulamos un registro exitoso
      const mockUser: User = {
        id: '123',
        name: name,
        email: email,
      };

      // Guardar en localStorage para persistencia
      localStorage.setItem('user', JSON.stringify(mockUser));
      setUser(mockUser);
    } catch (err) {
      setError('Error al registrarse. Por favor, inténtalo de nuevo.');
      console.error('Error de registro:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        logout,
        register,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
