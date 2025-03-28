import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/musicverse';

// Estado de la conexión
let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

export async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts)
      .then((mongoose) => {
        console.log('Conexión a MongoDB establecida correctamente');
        return mongoose;
      })
      .catch((error) => {
        console.error('Error al conectar con MongoDB:', error);
        throw error;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

// Manejador de eventos de conexión
mongoose.connection.on('connected', () => {
  console.log('MongoDB conectado');
});

mongoose.connection.on('error', (err) => {
  console.error('Error de conexión MongoDB:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB desconectado');
});

// Cerrar conexión correctamente al terminar la aplicación
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  process.exit(0);
}); 