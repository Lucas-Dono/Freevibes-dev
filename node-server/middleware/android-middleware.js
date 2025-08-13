/**
 * Middleware específico para aplicaciones Android
 * Detecta y maneja requests provenientes de la app móvil
 */

/**
 * Detecta si el request proviene de una aplicación Android
 * @param {Object} req - Request object
 * @returns {boolean} True si es una app Android
 */
function isAndroidApp(req) {
  const userAgent = req.headers['user-agent'] || '';
  const androidHeader = req.headers['x-android-app'];
  const appVersion = req.headers['x-app-version'];
  
  // Verificar múltiples indicadores de app Android
  return (
    androidHeader === 'freevibes' ||
    userAgent.toLowerCase().includes('freevibes-android') ||
    userAgent.toLowerCase().includes('android') ||
    appVersion !== undefined
  );
}

/**
 * Middleware para detectar aplicaciones Android
 * Agrega información sobre el cliente al request
 */
function detectAndroidApp(req, res, next) {
  const isAndroid = isAndroidApp(req);
  const userAgent = req.headers['user-agent'] || '';
  const appVersion = req.headers['x-app-version'] || 'unknown';
  
  // Agregar información del cliente al request
  req.clientInfo = {
    isAndroid,
    userAgent,
    appVersion,
    platform: isAndroid ? 'android' : 'web',
    timestamp: new Date().toISOString()
  };
  
  // Log para debugging
  if (isAndroid) {
    console.log(`[${new Date().toISOString()}] Android App Request:`, {
      method: req.method,
      path: req.path,
      appVersion,
      userAgent: userAgent.substring(0, 100) // Limitar longitud del log
    });
  }
  
  next();
}

/**
 * Middleware para agregar headers específicos para Android
 * Optimiza las respuestas para aplicaciones móviles
 */
function optimizeForAndroid(req, res, next) {
  if (req.clientInfo?.isAndroid) {
    // Headers específicos para Android
    res.setHeader('X-Optimized-For', 'android');
    res.setHeader('X-Cache-Control', 'public, max-age=300'); // 5 minutos de cache
    res.setHeader('X-Content-Encoding', 'gzip');
    
    // Interceptar respuestas JSON para optimizar
    const originalJson = res.json;
    res.json = function(data) {
      // Agregar metadata específica para Android
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        data._android = {
          optimized: true,
          timestamp: new Date().toISOString(),
          version: req.clientInfo.appVersion
        };
      }
      
      return originalJson.call(this, data);
    };
  }
  
  next();
}

/**
 * Middleware para validar versión de la app Android
 * Bloquea versiones obsoletas o no soportadas
 */
function validateAndroidVersion(req, res, next) {
  if (!req.clientInfo?.isAndroid) {
    return next();
  }
  
  const appVersion = req.clientInfo.appVersion;
  const minSupportedVersion = process.env.MIN_ANDROID_VERSION || '1.0.0';
  
  // Función simple para comparar versiones (formato x.y.z)
  function compareVersions(version1, version2) {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
      
      if (v1Part < v2Part) return -1;
      if (v1Part > v2Part) return 1;
    }
    
    return 0;
  }
  
  // Verificar si la versión es válida
  if (appVersion === 'unknown' || appVersion === 'dev') {
    // Permitir versiones de desarrollo
    return next();
  }
  
  if (compareVersions(appVersion, minSupportedVersion) < 0) {
    return res.status(426).json({
      success: false,
      message: 'Versión de la aplicación no soportada',
      error: 'UPDATE_REQUIRED',
      minVersion: minSupportedVersion,
      currentVersion: appVersion,
      updateUrl: process.env.ANDROID_UPDATE_URL || 'https://play.google.com/store/apps/details?id=com.freevibes.android'
    });
  }
  
  next();
}

/**
 * Middleware para rate limiting específico de Android
 * Aplica límites más permisivos para apps móviles
 */
function androidRateLimit(req, res, next) {
  if (!req.clientInfo?.isAndroid) {
    return next();
  }
  
  // Para apps Android, aplicar rate limiting más permisivo
  // Esto se puede implementar con express-rate-limit si es necesario
  
  // Por ahora, solo agregar headers informativos
  res.setHeader('X-RateLimit-Limit', '1000');
  res.setHeader('X-RateLimit-Remaining', '999');
  res.setHeader('X-RateLimit-Reset', new Date(Date.now() + 60000).toISOString());
  
  next();
}

/**
 * Middleware para logging específico de Android
 * Registra métricas y errores específicos de la app móvil
 */
function androidLogger(req, res, next) {
  if (!req.clientInfo?.isAndroid) {
    return next();
  }
  
  const startTime = Date.now();
  
  // Interceptar el final de la respuesta
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Date.now() - startTime;
    
    // Log específico para Android
    console.log(`[ANDROID] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms - v${req.clientInfo.appVersion}`);
    
    // Si hay error, log adicional
    if (res.statusCode >= 400) {
      console.error(`[ANDROID ERROR] ${req.method} ${req.path} - ${res.statusCode} - User: ${req.user?.email || 'anonymous'}`);
    }
    
    return originalEnd.apply(this, args);
  };
  
  next();
}

module.exports = {
  isAndroidApp,
  detectAndroidApp,
  optimizeForAndroid,
  validateAndroidVersion,
  androidRateLimit,
  androidLogger
};