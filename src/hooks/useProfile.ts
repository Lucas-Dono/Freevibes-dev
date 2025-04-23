import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

export interface Playlist {
  id: string;
  name: string;
  imageUrl: string;
  description?: string;
  owner: string;
  trackCount: number;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  albumCover: string;
  playedAt?: string;
}

export interface Artist {
  id: string;
  name: string;
  imageUrl: string;
  followers?: number;
  genres?: string[];
}

export interface UserStatistics {
  totalListeningTime: number;
  totalTracks: number;
  favoriteGenre: string;
  averageDailyTime: number;
}

export interface UserProfile {
  id: string;
  name: string;
  username: string;
  email: string;
  bio: string;
  profileImage: string;
  coverImage: string;
  favoriteGenres: Array<{ name: string; color?: string }>;
  followers: number;
  following: number;
  playlists?: Playlist[];
  recentlyPlayed?: Track[];
  topArtists?: Artist[];
  statistics?: UserStatistics;
}

interface UseProfileReturn {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  updateProfile: (data: Partial<UserProfile>) => Promise<UserProfile | null>;
  refreshProfile: () => Promise<void>;
}

export default function useProfile(): UseProfileReturn {
  const { data: session } = useSession();
  const user = session?.user;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Función para obtener el perfil del usuario
  const fetchProfile = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/user/profile');

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al obtener el perfil');
      }

      const profileData = await response.json();
      setProfile(profileData);
      return profileData;
    } catch (err) {
      console.error('Error al cargar el perfil:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Función para actualizar el perfil
  const updateProfile = useCallback(async (data: Partial<UserProfile>): Promise<UserProfile | null> => {
    if (!user) {
      setError('Necesitas iniciar sesión para actualizar tu perfil');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al actualizar el perfil');
      }

      const updatedProfile = await response.json();
      setProfile(updatedProfile);
      return updatedProfile;
    } catch (err) {
      console.error('Error al actualizar el perfil:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Función para refrescar el perfil
  const refreshProfile = useCallback(async () => {
    await fetchProfile();
  }, [fetchProfile]);

  // Cargar el perfil cuando cambia el usuario
  useEffect(() => {
    if (user) {
      fetchProfile();
    } else {
      setProfile(null);
      setLoading(false);
    }
  }, [user, fetchProfile]);

  return {
    profile,
    loading,
    error,
    updateProfile,
    refreshProfile,
  };
}
