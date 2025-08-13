const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// Configuración JWT
const JWT_SECRET = process.env.JWT_SECRET || 'freevibes-secret-key-2025';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'freevibes-refresh-secret-2025';
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '1h';
const JWT_REFRESH_EXPIRATION = process.env.JWT_REFRESH_EXPIRATION || '7d';

// Almacenamiento temporal de usuarios (en producción usar base de datos)
const users = new Map();
const refreshTokens = new Map();

/**
 * Genera un token JWT
 * @param {Object} payload - Datos del usuario
 * @param {string} secret - Secreto para firmar
 * @param {string} expiresIn - Tiempo de expiración
 * @returns {string} Token JWT
 */
function generateToken(payload, secret = JWT_SECRET, expiresIn = JWT_EXPIRATION) {
  return jwt.sign(payload, secret, { expiresIn });
}

/**
 * Verifica un token JWT
 * @param {string} token - Token a verificar
 * @param {string} secret - Secreto para verificar
 * @returns {Object|null} Payload decodificado o null si es inválido
 */
function verifyToken(token, secret = JWT_SECRET) {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    console.error('Error verificando token:', error.message);
    return null;
  }
}

/**
 * Genera un refresh token único
 * @returns {string} Refresh token
 */
function generateRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

/**
 * Hashea una contraseña
 * @param {string} password - Contraseña en texto plano
 * @returns {Promise<string>} Contraseña hasheada
 */
async function hashPassword(password) {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

/**
 * Compara una contraseña con su hash
 * @param {string} password - Contraseña en texto plano
 * @param {string} hash - Hash almacenado
 * @returns {Promise<boolean>} True si coinciden
 */
async function comparePassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

/**
 * Registra un nuevo usuario
 * @param {string} email - Email del usuario
 * @param {string} password - Contraseña del usuario
 * @param {string} name - Nombre del usuario
 * @returns {Promise<Object>} Resultado del registro
 */
async function registerUser(email, password, name) {
  try {
    // Verificar si el usuario ya existe
    if (users.has(email)) {
      return {
        success: false,
        message: 'El usuario ya existe'
      };
    }

    // Validar datos
    if (!email || !password || !name) {
      return {
        success: false,
        message: 'Email, contraseña y nombre son requeridos'
      };
    }

    if (password.length < 6) {
      return {
        success: false,
        message: 'La contraseña debe tener al menos 6 caracteres'
      };
    }

    // Hashear contraseña
    const hashedPassword = await hashPassword(password);

    // Crear usuario
    const userId = crypto.randomUUID();
    const user = {
      id: userId,
      email,
      name,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
      isActive: true
    };

    users.set(email, user);

    return {
      success: true,
      message: 'Usuario registrado exitosamente',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt
      }
    };
  } catch (error) {
    console.error('Error registrando usuario:', error);
    return {
      success: false,
      message: 'Error interno del servidor'
    };
  }
}

/**
 * Autentica un usuario
 * @param {string} email - Email del usuario
 * @param {string} password - Contraseña del usuario
 * @returns {Promise<Object>} Resultado de la autenticación
 */
async function loginUser(email, password) {
  try {
    // Buscar usuario
    const user = users.get(email);
    if (!user) {
      return {
        success: false,
        message: 'Credenciales inválidas'
      };
    }

    // Verificar contraseña
    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      return {
        success: false,
        message: 'Credenciales inválidas'
      };
    }

    // Verificar si el usuario está activo
    if (!user.isActive) {
      return {
        success: false,
        message: 'Cuenta desactivada'
      };
    }

    // Generar tokens
    const accessToken = generateToken({
      userId: user.id,
      email: user.email,
      name: user.name
    });

    const refreshToken = generateRefreshToken();
    
    // Almacenar refresh token
    refreshTokens.set(refreshToken, {
      userId: user.id,
      email: user.email,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 días
    });

    return {
      success: true,
      message: 'Login exitoso',
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    };
  } catch (error) {
    console.error('Error en login:', error);
    return {
      success: false,
      message: 'Error interno del servidor'
    };
  }
}

/**
 * Refresca un access token usando un refresh token
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<Object>} Nuevo access token o error
 */
async function refreshAccessToken(refreshToken) {
  try {
    // Verificar si el refresh token existe
    const tokenData = refreshTokens.get(refreshToken);
    if (!tokenData) {
      return {
        success: false,
        message: 'Refresh token inválido'
      };
    }

    // Verificar si el refresh token ha expirado
    if (new Date() > new Date(tokenData.expiresAt)) {
      refreshTokens.delete(refreshToken);
      return {
        success: false,
        message: 'Refresh token expirado'
      };
    }

    // Buscar usuario
    const user = users.get(tokenData.email);
    if (!user || !user.isActive) {
      refreshTokens.delete(refreshToken);
      return {
        success: false,
        message: 'Usuario no encontrado o inactivo'
      };
    }

    // Generar nuevo access token
    const newAccessToken = generateToken({
      userId: user.id,
      email: user.email,
      name: user.name
    });

    return {
      success: true,
      accessToken: newAccessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    };
  } catch (error) {
    console.error('Error refrescando token:', error);
    return {
      success: false,
      message: 'Error interno del servidor'
    };
  }
}

/**
 * Middleware para verificar autenticación JWT
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Token de acceso requerido'
    });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(403).json({
      success: false,
      message: 'Token inválido o expirado'
    });
  }

  // Agregar información del usuario al request
  req.user = decoded;
  next();
}

/**
 * Cierra sesión invalidando el refresh token
 * @param {string} refreshToken - Refresh token a invalidar
 * @returns {Object} Resultado del logout
 */
function logoutUser(refreshToken) {
  try {
    if (refreshTokens.has(refreshToken)) {
      refreshTokens.delete(refreshToken);
      return {
        success: true,
        message: 'Sesión cerrada exitosamente'
      };
    }
    
    return {
      success: true,
      message: 'Sesión ya cerrada'
    };
  } catch (error) {
    console.error('Error en logout:', error);
    return {
      success: false,
      message: 'Error cerrando sesión'
    };
  }
}

module.exports = {
  generateToken,
  verifyToken,
  generateRefreshToken,
  hashPassword,
  comparePassword,
  registerUser,
  loginUser,
  refreshAccessToken,
  authenticateToken,
  logoutUser,
  JWT_SECRET,
  JWT_REFRESH_SECRET
};