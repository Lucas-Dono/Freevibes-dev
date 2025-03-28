import User, { IUser, ISpotifyInfo } from '../models/User';
import { connectToDatabase } from '../mongodb';

// Crear o actualizar un usuario con la información de Spotify
export async function upsertUserWithSpotifyInfo(spotifyInfo: ISpotifyInfo): Promise<IUser> {
  try {
    await connectToDatabase();
    
    // Datos básicos a actualizar
    const userData = {
      spotifyId: spotifyInfo.id,
      email: spotifyInfo.email || `user-${spotifyInfo.id}@example.com`,
      name: spotifyInfo.display_name || `Usuario ${spotifyInfo.id}`,
      profileImage: spotifyInfo.images && spotifyInfo.images.length > 0 
        ? spotifyInfo.images[0].url 
        : '',
      spotifyInfo
    };

    // Buscar usuario existente o crear uno nuevo
    const existingUser = await User.findOne({ spotifyId: spotifyInfo.id });
    
    if (existingUser) {
      // Actualizar usuario existente (solo los campos que vienen de Spotify)
      const updatedUser = await User.findOneAndUpdate(
        { spotifyId: spotifyInfo.id },
        { 
          $set: {
            email: userData.email,
            name: userData.name,
            profileImage: userData.profileImage,
            spotifyInfo: spotifyInfo,
          }
        },
        { new: true }
      );
      
      return updatedUser as IUser;
    } else {
      // Crear nuevo usuario
      const newUser = new User(userData);
      await newUser.save();
      return newUser;
    }
  } catch (error) {
    console.error('Error al guardar usuario en MongoDB:', error);
    throw error;
  }
}

// Obtener usuario por ID de Spotify
export async function getUserBySpotifyId(spotifyId: string): Promise<IUser | null> {
  try {
    await connectToDatabase();
    return await User.findOne({ spotifyId });
  } catch (error) {
    console.error('Error al obtener usuario por spotifyId:', error);
    throw error;
  }
}

// Actualizar perfil de usuario
export async function updateUserProfile(
  spotifyId: string, 
  profileData: {
    username?: string;
    bio?: string;
    profileImage?: string;
    coverImage?: string;
    favoriteGenres?: Array<{ name: string; color?: string }>;
  }
): Promise<IUser | null> {
  try {
    await connectToDatabase();
    
    // Actualizar solo los campos proporcionados
    const updateData: any = {};
    
    if (profileData.username) updateData.username = profileData.username;
    if (profileData.bio) updateData.bio = profileData.bio;
    if (profileData.profileImage) updateData.profileImage = profileData.profileImage;
    if (profileData.coverImage) updateData.coverImage = profileData.coverImage;
    if (profileData.favoriteGenres) updateData.favoriteGenres = profileData.favoriteGenres;
    
    return await User.findOneAndUpdate(
      { spotifyId },
      { $set: updateData },
      { new: true }
    );
  } catch (error) {
    console.error('Error al actualizar perfil de usuario:', error);
    throw error;
  }
}

// Obtener todos los usuarios (con paginación)
export async function getAllUsers(page = 1, limit = 20): Promise<{ users: IUser[]; total: number }> {
  try {
    await connectToDatabase();
    
    const skip = (page - 1) * limit;
    
    const [users, total] = await Promise.all([
      User.find({})
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      User.countDocuments({})
    ]);
    
    return { users, total };
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    throw error;
  }
} 