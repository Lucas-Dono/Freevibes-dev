import mongoose, { Schema, Model } from 'mongoose';

interface IRecentTrack {
  userId: string;
  trackId: string;
  trackName: string;
  artistName: string;
  albumName?: string;
  albumCover?: string;
  playedAt: Date;
  source: 'spotify' | 'deezer' | 'lastfm' | 'youtube' | 'local';
  sourceData?: {
    uri?: string;
    url?: string;
    duration_ms?: number;
  };
}

// Definimos la interfaz del documento con su ID
interface IRecentTrackDocument extends IRecentTrack, mongoose.Document {}

// Definimos interfaz para métodos estáticos
interface IRecentTrackModel extends Model<IRecentTrackDocument> {
  addToHistory(trackData: IRecentTrack): Promise<boolean>;
}

const RecentTrackSchema = new Schema<IRecentTrackDocument>(
  {
    userId: { type: String, required: true, index: true },
    trackId: { type: String, required: true },
    trackName: { type: String, required: true },
    artistName: { type: String, required: true },
    albumName: { type: String },
    albumCover: { type: String },
    playedAt: { type: Date, default: Date.now, index: true },
    source: { 
      type: String, 
      required: true,
      enum: ['spotify', 'deezer', 'lastfm', 'youtube', 'local'] 
    },
    sourceData: {
      uri: { type: String },
      url: { type: String },
      duration_ms: { type: Number }
    }
  },
  { timestamps: true }
);

// Creamos un índice compuesto para evitar duplicados inmediatos
// y ordenamos por fecha de reproducción descendente
RecentTrackSchema.index({ userId: 1, trackId: 1, playedAt: -1 });

// Método estático para añadir una canción al historial
RecentTrackSchema.statics.addToHistory = async function(trackData: IRecentTrack) {
  // Primero añadimos la nueva entrada
  await this.create(trackData);
  
  // Luego limitamos el historial a 50 canciones por usuario
  const tracksCount = await this.countDocuments({ userId: trackData.userId });
  
  if (tracksCount > 50) {
    // Obtenemos las canciones más antiguas que excedan el límite
    const oldestTracks = await this.find({ userId: trackData.userId })
      .sort({ playedAt: 1 })
      .limit(tracksCount - 50);
      
    // Eliminamos las canciones más antiguas
    if (oldestTracks.length > 0) {
      await this.deleteMany({
        _id: { $in: oldestTracks.map((track: IRecentTrackDocument) => track._id) }
      });
    }
  }
  
  return true;
};

// Exportamos el modelo o lo creamos si no existe
export const RecentTrack = (mongoose.models.RecentTrack as IRecentTrackModel) || 
  mongoose.model<IRecentTrackDocument, IRecentTrackModel>('RecentTrack', RecentTrackSchema);

export type { IRecentTrack }; 