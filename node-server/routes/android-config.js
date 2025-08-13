const express = require('express');
const { isAndroidApp } = require('../middleware/android-middleware');
const router = express.Router();

/**
 * @route GET /api/android/config
 * @desc Obtener configuración específica para Android
 * @access Public
 */
router.get('/config', (req, res) => {
  try {
    const isAndroid = req.clientInfo?.isAndroid || false;
    
    const config = {
      success: true,
      android: {
        supported: true,
        minVersion: process.env.MIN_ANDROID_VERSION || '1.0.0',
        currentApiVersion: '1.0.0',
        updateUrl: process.env.ANDROID_UPDATE_URL || 'https://play.google.com/store/apps/details?id=com.freevibes.android',
        features: {
          authentication: true,
          playlists: true,
          search: true,
          streaming: true,
          offline: false // Por implementar
        },
        endpoints: {
          auth: '/api/auth',
          user: '/api/user',
          youtube: '/api/youtube',
          search: '/api/youtube/search',
          suggestions: '/api/combined/suggest'
        },
        rateLimit: {
          requests: 1000,
          windowMs: 900000, // 15 minutos
          message: 'Límite de requests excedido'
        }
      },
      server: {
        status: 'online',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
      },
      client: {
        detected: isAndroid ? 'android' : 'web',
        userAgent: req.headers['user-agent']?.substring(0, 100) || 'unknown',
        version: req.clientInfo?.appVersion || 'unknown'
      }
    };
    
    res.status(200).json(config);
  } catch (error) {
    console.error('Error obteniendo configuración Android:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * @route GET /api/android/health
 * @desc Health check específico para Android
 * @access Public
 */
router.get('/health', (req, res) => {
  try {
    const isAndroid = req.clientInfo?.isAndroid || false;
    
    const health = {
      success: true,
      status: 'healthy',
      android: {
        supported: true,
        optimized: isAndroid,
        version: req.clientInfo?.appVersion || 'unknown'
      },
      services: {
        auth: 'online',
        database: 'online', // Simulado
        pythonApi: 'online', // Se podría verificar realmente
        cache: 'online'
      },
      performance: {
        uptime: process.uptime(),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
        }
      },
      timestamp: new Date().toISOString()
    };
    
    res.status(200).json(health);
  } catch (error) {
    console.error('Error en health check Android:', error);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      message: 'Error interno del servidor'
    });
  }
});

/**
 * @route POST /api/android/feedback
 * @desc Recibir feedback de la aplicación Android
 * @access Public
 */
router.post('/feedback', (req, res) => {
  try {
    const { type, message, metadata } = req.body;
    
    // Validación básica
    if (!type || !message) {
      return res.status(400).json({
        success: false,
        message: 'Tipo y mensaje son requeridos'
      });
    }
    
    const feedback = {
      id: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type, // 'bug', 'feature', 'improvement', 'other'
      message,
      metadata: metadata || {},
      client: {
        platform: req.clientInfo?.platform || 'unknown',
        version: req.clientInfo?.appVersion || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown'
      },
      timestamp: new Date().toISOString()
    };
    
    // En producción, guardar en base de datos
    console.log('[ANDROID FEEDBACK]', feedback);
    
    res.status(201).json({
      success: true,
      message: 'Feedback recibido exitosamente',
      feedbackId: feedback.id
    });
  } catch (error) {
    console.error('Error procesando feedback Android:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * @route GET /api/android/features
 * @desc Obtener lista de características disponibles para Android
 * @access Public
 */
router.get('/features', (req, res) => {
  try {
    const features = {
      success: true,
      features: [
        {
          name: 'authentication',
          enabled: true,
          description: 'Sistema de autenticación JWT',
          endpoints: ['/api/auth/login', '/api/auth/register', '/api/auth/refresh']
        },
        {
          name: 'user_playlists',
          enabled: true,
          description: 'Gestión de playlists personalizadas',
          endpoints: ['/api/user/playlists']
        },
        {
          name: 'music_search',
          enabled: true,
          description: 'Búsqueda de música en YouTube',
          endpoints: ['/api/youtube/search']
        },
        {
          name: 'suggestions',
          enabled: true,
          description: 'Sugerencias de búsqueda combinadas',
          endpoints: ['/api/combined/suggest']
        },
        {
          name: 'recommendations',
          enabled: true,
          description: 'Recomendaciones musicales',
          endpoints: ['/api/youtube/recommendations']
        },
        {
          name: 'streaming',
          enabled: true,
          description: 'Streaming de audio desde YouTube',
          endpoints: ['/api/youtube/*']
        },
        {
          name: 'offline_mode',
          enabled: false,
          description: 'Modo offline (próximamente)',
          endpoints: []
        }
      ],
      totalFeatures: 7,
      enabledFeatures: 6,
      timestamp: new Date().toISOString()
    };
    
    res.status(200).json(features);
  } catch (error) {
    console.error('Error obteniendo características Android:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

module.exports = router;