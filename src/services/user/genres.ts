/**
 * Servicio para manejar los géneros musicales de los usuarios
 */
import User, { IGenre } from '@/lib/db/models/User';
import { connectToDatabase } from '@/lib/db/mongodb';
import { getSpotify } from '@/lib/spotify';

// Definir interfaz para artistas de Spotify
interface SpotifyArtist {
  id: string;
  name: string;
  genres?: string[];
  images?: Array<{url: string}>;
  popularity?: number;
}

/**
 * Obtiene los géneros musicales de un usuario
 * @param userId ID del usuario (en este caso, spotifyId)
 * @returns Array con los géneros musicales del usuario
 */
export async function getUserGenres(userId: string): Promise<string[]> {
  try {
    await connectToDatabase();
    
    // Obtener el usuario con sus géneros favoritos
    const user = await User.findOne({ spotifyId: userId });

    // Si el usuario existe y tiene géneros guardados, devolverlos
    if (user && user.favoriteGenres && user.favoriteGenres.length > 0) {
      return user.favoriteGenres.map((genre: IGenre) => genre.name);
    }

    // Si no hay géneros guardados, intentar obtenerlos de Spotify
    console.log('No se encontraron géneros en la base de datos, intentando obtener de Spotify');
    
    try {
      // Obtener los artistas top del usuario en Spotify
      const sp = await getSpotify();
      const topArtists = await sp.getMyTopArtists({ limit: 10, time_range: 'medium_term' });
      
      if (!topArtists.items || topArtists.items.length === 0) {
        console.log('No se encontraron artistas top en Spotify');
        return [];
      }
      
      // Extraer géneros de los artistas favoritos
      const artistGenres = topArtists.items.flatMap((artist: SpotifyArtist) => artist.genres || []);
      
      // Contar la frecuencia de cada género
      const genreCounts: Record<string, number> = {};
      artistGenres.forEach((genre: string) => {
        genreCounts[genre] = (genreCounts[genre] || 0) + 1;
      });
      
      // Ordenar géneros por frecuencia
      const sortedGenres = Object.entries(genreCounts)
        .sort((a, b) => b[1] - a[1])
        .map(entry => entry[0]);
      
      // Guardar los géneros en la base de datos para futuras consultas
      if (sortedGenres.length > 0 && user) {
        const genreObjects = sortedGenres.map(name => ({ name }));
        user.favoriteGenres = genreObjects;
        await user.save();
        console.log(`Géneros obtenidos de Spotify guardados en la base de datos: ${sortedGenres.join(', ')}`);
      }
      
      return sortedGenres;
    } catch (spotifyError) {
      console.error('Error al obtener géneros de Spotify:', spotifyError);
      return [];
    }
  } catch (error) {
    console.error('Error al obtener géneros del usuario:', error);
    return [];
  }
}

/**
 * Guarda los géneros musicales de un usuario
 * @param userId ID del usuario (spotifyId)
 * @param genres Array con los géneros musicales a guardar
 * @returns Usuario actualizado
 */
export async function saveUserGenres(userId: string, genres: string[]) {
  try {
    await connectToDatabase();
    
    // Transformar géneros a formato IGenre
    const genreObjects = genres.map(name => ({ name }));
    
    const updatedUser = await User.findOneAndUpdate(
      { spotifyId: userId },
      { favoriteGenres: genreObjects },
      { new: true }
    );
    
    return updatedUser;
  } catch (error) {
    console.error('Error al guardar géneros del usuario:', error);
    throw error;
  }
}

/**
 * Agrega un género musical a un usuario
 * @param userId ID del usuario (spotifyId)
 * @param genre Género musical a agregar
 * @returns Usuario actualizado
 */
export async function addUserGenre(userId: string, genre: string) {
  try {
    await connectToDatabase();
    
    const user = await User.findOne({ spotifyId: userId });
    
    if (!user) {
      throw new Error('Usuario no encontrado');
    }
    
    // Verificar si el género ya existe
    const genreExists = user.favoriteGenres.some((g: IGenre) => g.name === genre);
    
    if (genreExists) {
      return user;
    }
    
    // Agregar el nuevo género
    user.favoriteGenres.push({ name: genre });
    await user.save();
    
    return user;
  } catch (error) {
    console.error('Error al agregar género al usuario:', error);
    throw error;
  }
}

/**
 * Elimina un género musical de un usuario
 * @param userId ID del usuario (spotifyId)
 * @param genre Género musical a eliminar
 * @returns Usuario actualizado
 */
export async function removeUserGenre(userId: string, genre: string) {
  try {
    await connectToDatabase();
    
    const user = await User.findOne({ spotifyId: userId });
    
    if (!user) {
      throw new Error('Usuario no encontrado');
    }
    
    // Filtrar el género a eliminar
    user.favoriteGenres = user.favoriteGenres.filter((g: IGenre) => g.name !== genre);
    await user.save();
    
    return user;
  } catch (error) {
    console.error('Error al eliminar género del usuario:', error);
    throw error;
  }
} 