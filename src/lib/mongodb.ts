import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || '';

if (!MONGODB_URI) {
  throw new Error(
    'Por favor, define la variable de entorno MONGODB_URI en tu archivo .env.local'
  );
}

/**
 * Variable global para mantener la conexión a lo largo de las solicitudes
 */
declare global {
  var mongoose: {
    connection: mongoose.Connection | null;
    promise: Promise<mongoose.Connection> | null;
  };
}

global.mongoose = global.mongoose || {
  connection: null,
  promise: null,
};

/**
 * Conecta a MongoDB y reutiliza la conexión existente si ya existe
 */
export async function connectToDatabase(): Promise<mongoose.Connection> {
  if (global.mongoose && global.mongoose.connection) {
    if (global.mongoose.connection.readyState === 1) {
      return global.mongoose.connection;
    }
  }

  if (!global.mongoose.promise) {
    const opts = {
      bufferCommands: false,
    };

    global.mongoose.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      return mongoose.connection;
    });
  }

  global.mongoose.connection = await global.mongoose.promise;
  return global.mongoose.connection;
}
