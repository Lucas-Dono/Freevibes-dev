import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { API_CONFIG } from '@/config/api-config';

export async function GET(request: NextRequest) {
  try {
    // Verificar si estamos en modo demo
    const isDemoMode = API_CONFIG.isDemoMode();

    if (isDemoMode) {
      console.log('[MongoDB Status] Modo demo activado - no se conecta a MongoDB');
      return NextResponse.json({
        status: 'ok',
        message: 'Modo demo: no se requiere conexión a MongoDB',
        demoMode: true,
        dbInfo: {
          connected: true,
          connection: true,
          hasDb: true,
          readyState: 1,
          name: 'demo-database'
        },
        collections: ['demo-collection-1', 'demo-collection-2'],
        mongodbUri: 'mongodb://demo-user:****@demo-cluster.mongodb.net/demo-db'
      });
    }

    // Intentar conectar a MongoDB
    const conn = await connectToDatabase();

    // Verificar que tenemos una conexión válida
    if (!conn) {
      throw new Error('Conexión no establecida');
    }

    let dbInfo = {
      connected: !!conn,
      connection: !!conn.connection,
      hasDb: !!(conn.connection && conn.connection.db),
      readyState: conn.connection ? conn.connection.readyState : -1,
      name: conn.connection && conn.connection.db ? conn.connection.db.databaseName : 'unknown'
    };

    // Verificar que podemos listar colecciones
    let collections = [];
    if (conn.connection && conn.connection.db) {
      collections = await conn.connection.db.listCollections().toArray();
      collections = collections.map((c: { name: string }) => c.name);
    }

    // Todo OK
    return NextResponse.json({
      status: 'ok',
      message: 'Conexión a MongoDB establecida correctamente',
      dbInfo,
      collections,
      mongodbUri: process.env.MONGODB_URI?.replace(/:[^:@]+@/, ':****@') || 'no definido'
    });
  } catch (error: any) {
    console.error('[MongoDB Status] Error de conexión:', error);

    // Detectar errores DNS específicamente
    let errorMessage = 'Error al conectar con MongoDB';
    let errorDetails = error.message;

    if (error.message.includes('querySrv ENOTFOUND')) {
      errorMessage = 'Error de resolución DNS al conectar con MongoDB';
      errorDetails = 'No se pudo resolver el host de MongoDB. Verifica tu conexión a internet y que el dominio existe.';
    } else if (error.message.includes('MongoServerSelectionError')) {
      errorMessage = 'No se pudo seleccionar un servidor MongoDB';
      errorDetails = 'El servidor no está disponible o la URL es incorrecta.';
    }

    // Error de conexión
    return NextResponse.json({
      status: 'error',
      message: errorMessage,
      error: errorDetails,
      mongodbUri: process.env.MONGODB_URI?.replace(/:[^:@]+@/, ':****@') || 'no definido'
    }, { status: 500 });
  }
}
