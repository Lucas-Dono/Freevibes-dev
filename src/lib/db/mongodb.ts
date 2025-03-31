import { MongoClient, Db } from 'mongodb';

if (!process.env.MONGODB_URI) {
  throw new Error('Por favor, define la variable de entorno MONGODB_URI');
}

const uri = process.env.MONGODB_URI;
const options = {};

let clientPromise: Promise<MongoClient>;
let cachedDb: Db | null = null;
let client: MongoClient;

if (process.env.NODE_ENV === 'development') {
  // En desarrollo, usamos una variable global para preservar la conexión
  // entre recargas de HMR (Hot Module Replacement)
  let globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
    _mongoClient?: MongoClient;
  };

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise = client.connect();
    globalWithMongo._mongoClient = client;
  } else {
    // Reutilizar el cliente existente si ya está creado
    client = globalWithMongo._mongoClient!;
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  // En producción, creamos una nueva conexión
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

/**
 * Conecta a la base de datos MongoDB
 * Devuelve un objeto con cliente y conexión a la base de datos
 */
export async function connectToDatabase() {
  try {
    if (cachedDb) {
      // Si ya tenemos una conexión, la reutilizamos
      return { client, db: cachedDb };
    }

    // Esperar a que se conecte el cliente
    await clientPromise;
    
    // Obtener el nombre de la base de datos desde la URI o usar un valor predeterminado
    const dbName = process.env.MONGODB_DB || new URL(uri).pathname.substring(1) || 'music-player';
    
    // Establecer la conexión a la base de datos
    const db = client.db(dbName);
    
    // Guardar la conexión para reutilizarla
    cachedDb = db;
    
    return { client, db };
  } catch (error) {
    console.error('Error conectando a MongoDB:', error);
    return { client: null, db: null };
  }
}

// Exportar clientPromise para usar con NextAuth
export default clientPromise; 