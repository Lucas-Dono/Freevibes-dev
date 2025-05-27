import mongoose from 'mongoose';
import { API_CONFIG } from '@/config/api-config';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/freevibes';

// Estado de la conexión
let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

export async function connectToDatabase() {
  // Si estamos en modo demo, no necesitamos conectar a MongoDB
  if (API_CONFIG.isDemoMode()) {
    return null;
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000, // Timeout de 5 segundos para selección de servidor
      family: 4, // Forzar IPv4
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts)
      .then((mongoose) => {
        return mongoose;
      })
      .catch((error) => {
        console.error('[MongoDB] Error al conectar con MongoDB:', error);

        // Manejar errores específicamente
        if (error.code === 'ENOTFOUND' || error.message.includes('querySrv ENOTFOUND')) {
          console.error('[MongoDB] Error de resolución DNS. Asegúrate de tener conectividad a internet.');
        } else if (error.message.includes('authentication failed')) {
          console.error('[MongoDB] Error de autenticación. Verifica las credenciales.');
        } else if (error.name === 'MongooseServerSelectionError') {
          console.error('[MongoDB] No se pudo conectar al servidor. Verifica la URL y que el servidor esté en ejecución.');
        }

        throw error;
      });
  }

  try {
  cached.conn = await cached.promise;
  return cached.conn;
  } catch (error) {
    console.error('[MongoDB] Error esperando la conexión:', error);
    // No volver a intentar la conexión en este ciclo de solicitud
    cached.promise = null;
    return null;
  }
}

// Manejador de eventos de conexión
mongoose.connection.on('connected', () => {
  console.log('[MongoDB] Conexión establecida');
});

mongoose.connection.on('error', (err) => {
  console.error('[MongoDB] Error de conexión:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('[MongoDB] Desconectado de MongoDB');
});

// Cerrar conexión correctamente al terminar la aplicación
process.on('SIGINT', async () => {
  if (mongoose.connection.readyState !== 0) {
  await mongoose.connection.close();
    console.log('[MongoDB] Conexión cerrada por terminación de aplicación');
  }
  process.exit(0);
});
