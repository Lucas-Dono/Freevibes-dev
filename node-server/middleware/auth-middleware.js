const { authenticateToken } = require('../auth/jwt-auth');

/**
 * Middleware opcional de autenticación
 * Permite el acceso sin autenticación pero agrega información del usuario si está autenticado
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    // No hay token, continuar sin usuario autenticado
    req.user = null;
    return next();
  }

  const { verifyToken } = require('../auth/jwt-auth');
  const decoded = verifyToken(token);
  
  if (decoded) {
    // Token válido, agregar información del usuario
    req.user = decoded;
  } else {
    // Token inválido, continuar sin usuario autenticado
    req.user = null;
  }
  
  next();
}

/**
 * Middleware de autenticación requerida
 * Bloquea el acceso si no hay un token válido
 */
function requireAuth(req, res, next) {
  return authenticateToken(req, res, next);
}

/**
 * Middleware para verificar si el usuario es el propietario del recurso
 * @param {string} userIdField - Campo en req.params que contiene el ID del usuario
 */
function requireOwnership(userIdField = 'userId') {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Autenticación requerida'
      });
    }

    const resourceUserId = req.params[userIdField];
    const currentUserId = req.user.userId;

    if (resourceUserId !== currentUserId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para acceder a este recurso'
      });
    }

    next();
  };
}

/**
 * Middleware para agregar información de usuario a las respuestas
 * Útil para personalizar contenido basado en el usuario autenticado
 */
function enrichWithUserInfo(req, res, next) {
  // Guardar el método send original
  const originalSend = res.send;
  
  // Sobrescribir el método send
  res.send = function(data) {
    try {
      // Si hay un usuario autenticado y la respuesta es JSON
      if (req.user && typeof data === 'string') {
        const parsedData = JSON.parse(data);
        
        // Agregar información del usuario si la respuesta es exitosa
        if (parsedData.success !== false) {
          parsedData.authenticatedUser = {
            id: req.user.userId,
            email: req.user.email,
            name: req.user.name
          };
        }
        
        return originalSend.call(this, JSON.stringify(parsedData));
      }
    } catch (error) {
      // Si hay error parseando JSON, enviar la respuesta original
      console.warn('Error enriching response with user info:', error.message);
    }
    
    // Enviar respuesta original
    return originalSend.call(this, data);
  };
  
  next();
}

/**
 * Middleware para logging de actividad de usuarios autenticados
 */
function logUserActivity(req, res, next) {
  if (req.user) {
    console.log(`[${new Date().toISOString()}] Usuario ${req.user.email} (${req.user.userId}) accedió a ${req.method} ${req.path}`);
  }
  next();
}

module.exports = {
  optionalAuth,
  requireAuth,
  requireOwnership,
  enrichWithUserInfo,
  logUserActivity
};