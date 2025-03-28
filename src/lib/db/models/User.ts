import mongoose, { Schema, Document } from 'mongoose';

// Definición del tipo para géneros musicales
export interface IGenre {
  name: string;
  color?: string;
}

// Interfaz para la información de Spotify
export interface ISpotifyInfo {
  id: string;
  email?: string;
  display_name?: string;
  images?: Array<{
    url: string;
    height: number;
    width: number;
  }>;
  country?: string;
  product?: string;
  followers?: {
    total: number;
  };
  uri?: string;
}

// Interfaz principal del Usuario
export interface IUser extends Document {
  spotifyId: string;
  email: string;
  name: string;
  username: string;
  bio: string;
  profileImage: string;
  coverImage: string;
  favoriteGenres: IGenre[];
  spotifyInfo: ISpotifyInfo;
  playlists: string[];  // IDs de playlists creadas por el usuario
  followers: number;
  following: number;
  createdAt: Date;
  updatedAt: Date;
}

// Esquema para géneros musicales
const GenreSchema = new Schema<IGenre>({
  name: { type: String, required: true },
  color: { type: String },
});

// Esquema para la información de Spotify
const SpotifyInfoSchema = new Schema<ISpotifyInfo>({
  id: { type: String, required: true },
  email: { type: String },
  display_name: { type: String },
  images: [{ 
    url: String,
    height: Number,
    width: Number
  }],
  country: { type: String },
  product: { type: String },
  followers: { 
    total: { type: Number, default: 0 } 
  },
  uri: { type: String }
}, { _id: false });

// Esquema principal de Usuario
const UserSchema = new Schema<IUser>({
  spotifyId: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true 
  },
  name: { 
    type: String, 
    required: true 
  },
  username: { 
    type: String,
    unique: true,
    sparse: true
  },
  bio: { 
    type: String, 
    default: '' 
  },
  profileImage: { 
    type: String, 
    default: '' 
  },
  coverImage: { 
    type: String, 
    default: '' 
  },
  favoriteGenres: [GenreSchema],
  spotifyInfo: SpotifyInfoSchema,
  playlists: [{ 
    type: String 
  }],
  followers: { 
    type: Number, 
    default: 0 
  },
  following: { 
    type: Number, 
    default: 0 
  }
}, { timestamps: true });

// Crear o recuperar el modelo User
export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema); 