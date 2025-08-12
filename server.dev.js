import express from 'express';
import basicAuth from 'express-basic-auth';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import bodyParser from 'body-parser';
import cors from 'cors';
import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';
import {
  classificationPrompt,
  baseSystemPrompt,
  getKnowledgeForCategory
} from './src/ia/prompts.js';

// Importaciones para la base de datos y autenticación
import connectDB from './config/database.js';
// Importar rutas SQL para autenticación (nuevo)
import authRoutes from './routes/authRoutesSql.js';
// Importar rutas de pago
import paymentRoutes from './routes/paymentRoutes.js';
// Importar rutas de reembolso
import refundRoutes from './routes/refundRoutes.js';
// Importar rutas de usuario
import userRoutes from './routes/userRoutes.js';
// Importar rutas de administración
import adminRoutes from './routes/adminRoutes.js';
// Importar rutas de precios
import preciosRoutes from './routes/preciosRoutes.js';

// Importar controladores de pago
import { processPayment, createPreference, handleWebhook, processApiPayment } from './controllers/paymentController.js';

// Rutas explícitas para servicios de usuario (backup para solucionar problemas de rutas)
import * as userServicesController from './controllers/userServicesController.js';

// Cargar variables de entorno de desarrollo
dotenv.config({ path: '.env.dev' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración de OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const app = express();

// ========================================
// CONFIGURACIÓN ESPECÍFICA DE DESARROLLO
// ========================================

// Middleware de logging detallado para desarrollo
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`\n🔍 [${timestamp}] ${req.method} ${req.url}`);
  
  if (req.headers.authorization) {
    console.log('🔐 Authorization header present');
  }
  
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('📦 Request Body:', JSON.stringify(req.body, null, 2));
  }
  
  if (Object.keys(req.query).length > 0) {
    console.log('🔍 Query Params:', req.query);
  }
  
  // Interceptar respuesta para logging
  const originalSend = res.send;
  res.send = function(data) {
    console.log(`📤 Response Status: ${res.statusCode}`);
    if (res.statusCode >= 400) {
      console.log('❌ Error Response:', typeof data === 'string' ? data.substring(0, 200) : '[Object]');
    } else {
      console.log('✅ Success Response');
    }
    originalSend.apply(res, arguments);
  };
  
  next();
});

// Middleware para medir tiempo de respuesta
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`⏱️  Request completed in ${duration}ms`);
  });
  next();
});

// Llamamos a la inicialización de la base de datos PostgreSQL (Sequelize)
connectDB().then(sequelizeInstance => {
  if (sequelizeInstance || process.env.DISABLE_DB === 'true' || process.env.ENABLE_FILE_FALLBACK === 'true') {
    console.log('✅ Inicialización de base de datos (PostgreSQL/Sequelize o fallback) completada.');
  } else {
    console.error('❌ No se pudo inicializar la base de datos PostgreSQL y no hay modo fallback habilitado.');
  }
}).catch(error => {
  console.error('❌ Fallo crítico durante la inicialización de la base de datos (PostgreSQL/Sequelize):', error);
});

// IMPORTANTE: Configurar body-parser ANTES de las rutas
app.use(bodyParser.json({ limit: '50mb' })); // Límite mayor para desarrollo
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Middleware para manejar métodos PATCH y otros explícitamente
app.use((req, res, next) => {
  if (req.method === 'PATCH') {
    console.log(`🔧 Recibida solicitud PATCH: ${req.originalUrl}`);
  }
  next();
});

// Configuración de CORS más permisiva para desarrollo
const corsOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://localhost:5001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5001',
  process.env.CORS_FRONT,
  process.env.CORS_BACK,
].filter(Boolean);

console.log('🌐 CORS Development - Orígenes permitidos:', corsOrigins);

// Configuración CORS muy permisiva para desarrollo
app.use(cors({
  origin: function (origin, callback) {
    // En desarrollo, permitir todas las solicitudes
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // Permitir solicitudes sin origen (como aplicaciones móviles o curl)
    if (!origin) return callback(null, true);
    
    if (corsOrigins.indexOf(origin) !== -1 || origin.startsWith('http://localhost')) {
      callback(null, true);
    } else {
      console.warn(`⚠️ Origen bloqueado por CORS: ${origin}`);
      callback(null, true); // En desarrollo, permitir de todas formas
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization',
    'X-HTTP-Method-Override', 'x-meli-session-id', 'device-id', 'x-idempotency-key',
    'x-flow-id', 'x-product-id', 'x-tracking-id', 'Cookie', 'Set-Cookie'
  ],
  exposedHeaders: ['Content-Disposition', 'Set-Cookie']
}));

// Middleware adicional para asegurar que siempre se respondan preflight requests OPTIONS
app.options('*', cors());

// Middleware para forzar encabezados CORS en cada respuesta (desarrollo)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*'); // Muy permisivo para desarrollo
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
});

// Servir archivos estáticos del frontend (build de Vite)
app.use(express.static(path.join(__dirname, 'dist')));

// Middleware especial para depurar rutas de servicios
app.use('/api/users/services', (req, res, next) => {
  console.log(`🔎 Depuración de servicios: ${req.method} ${req.originalUrl}`);
  console.log(`🔧 Parámetros de ruta:`, req.params);
  console.log(`🔍 Query:`, req.query);
  console.log(`📦 Encabezados:`, req.headers);
  next();
});

// Middleware para configurar cookies (desarrollo)
app.use((req, res, next) => {
  const originalCookie = res.cookie;
  
  res.cookie = function (name, value, options = {}) {
    // Para desarrollo, usar opciones menos restrictivas
    options = {
      ...options,
      sameSite: 'lax', // Menos restrictivo que 'none'
      secure: false,   // No requerir HTTPS en desarrollo
      httpOnly: false,
      path: '/'
    };
    
    console.log(`🍪 Configurando cookie de desarrollo: ${name}`);
    return originalCookie.call(this, name, value, options);
  };
  
  next();
});

// ========================================
// RUTAS DE DESARROLLO Y DEBUGGING
// ========================================

// Ruta de health check mejorada para desarrollo
app.get('/api/health', (req, res) => {
  const healthInfo = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: 'development',
    version: process.env.npm_package_version || '1.0.0',
    node_version: process.version,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: {
      connected: process.env.DISABLE_DB !== 'true',
      fallback: process.env.ENABLE_FILE_FALLBACK === 'true'
    },
    services: {
      frontend: 'http://localhost:3000',
      backend: 'http://localhost:5001',
      admin: 'http://localhost:3000/admin',
      dashboard: 'http://localhost:3000/dashboard'
    }
  };
  
  console.log('🏥 Health check solicitado');
  res.json(healthInfo);
});

// Ruta de información de desarrollo
app.get('/api/dev/info', (req, res) => {
  const devInfo = {
    mode: 'development',
    cors_origins: corsOrigins,
    env_file: '.env.dev',
    debug_mode: process.env.DEBUG_MODE === 'true',
    hot_reload: process.env.HOT_RELOAD === 'true',
    database_url: process.env.DATABASE_URL,
    admin_credentials: {
      user: process.env.ADMIN_USER,
      // No mostrar la contraseña real en desarrollo
      password_set: !!process.env.ADMIN_PASS
    }
  };
  
  res.json(devInfo);
});

// Ruta para probar la conexión a la base de datos
app.get('/api/dev/db-test', async (req, res) => {
  try {
    // Aquí podrías agregar una consulta de prueba a la base de datos
    res.json({
      status: 'OK',
      message: 'Database connection test',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ========================================
// RUTAS PRINCIPALES
// ========================================

// Usar las rutas de autenticación SQL
app.use('/api/auth', authRoutes);

// Usar las rutas de pago
app.use('/api/payments', paymentRoutes);

// Usar las rutas de reembolso
app.use('/api/refunds', refundRoutes);

// Usar las rutas de usuario
app.use('/api/users', userRoutes);

// Usar las rutas de administración
app.use('/api/admin', adminRoutes);

// Usar las rutas de precios
app.use('/api/precios', preciosRoutes);

// Resto del código del servidor original...
// (Aquí incluirías el resto de las rutas y middleware del server.js original)

// ========================================
// MANEJO DE ERRORES PARA DESARROLLO
// ========================================

// Middleware de manejo de errores mejorado para desarrollo
app.use((err, req, res, next) => {
  console.error('🚨 Error en desarrollo:', err);
  
  // En desarrollo, mostrar stack trace completo
  const errorResponse = {
    error: {
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString(),
      url: req.url,
      method: req.method,
      headers: req.headers,
      body: req.body
    }
  };
  
  res.status(err.status || 500).json(errorResponse);
});

// Catch-all para rutas no encontradas
app.get('*', (req, res) => {
  // En desarrollo, servir el index.html para rutas del frontend
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// ========================================
// INICIO DEL SERVIDOR
// ========================================

const PORT = process.env.PORT || 5001;

app.listen(PORT, '0.0.0.0', () => {
  console.log('\n🚀 ========================================');
  console.log('🚀 SERVIDOR DE DESARROLLO INICIADO');
  console.log('🚀 ========================================');
  console.log(`🌐 Servidor ejecutándose en: http://localhost:${PORT}`);
  console.log(`🔧 API disponible en: http://localhost:${PORT}/api`);
  console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
  console.log(`ℹ️  Dev info: http://localhost:${PORT}/api/dev/info`);
  console.log(`🗄️  DB test: http://localhost:${PORT}/api/dev/db-test`);
  console.log('🚀 ========================================');
  console.log(`📝 Modo: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔍 Debug: ${process.env.DEBUG_MODE === 'true' ? 'Habilitado' : 'Deshabilitado'}`);
  console.log(`🔄 Hot Reload: ${process.env.HOT_RELOAD === 'true' ? 'Habilitado' : 'Deshabilitado'}`);
  console.log(`🗄️  Base de datos: ${process.env.DISABLE_DB === 'true' ? 'Deshabilitada' : 'PostgreSQL'}`);
  console.log('🚀 ========================================\n');
});

// Manejo de señales para cierre limpio
process.on('SIGTERM', () => {
  console.log('\n🛑 Recibida señal SIGTERM, cerrando servidor de desarrollo...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Recibida señal SIGINT (Ctrl+C), cerrando servidor de desarrollo...');
  process.exit(0);
});

export default app;