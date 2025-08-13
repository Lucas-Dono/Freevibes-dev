const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  registerUser,
  loginUser,
  refreshAccessToken,
  authenticateToken,
  logoutUser
} = require('../auth/jwt-auth');

const router = express.Router();

// Rate limiting para endpoints de autenticación
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 intentos por IP
  message: {
    success: false,
    message: 'Demasiados intentos de autenticación. Intenta de nuevo en 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // máximo 3 registros por IP por hora
  message: {
    success: false,
    message: 'Demasiados intentos de registro. Intenta de nuevo en 1 hora.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * @route POST /api/auth/register
 * @desc Registrar nuevo usuario
 * @access Public
 */
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validación básica
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: 'Email, contraseña y nombre son requeridos'
      });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Formato de email inválido'
      });
    }

    const result = await registerUser(email.toLowerCase().trim(), password, name.trim());

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * @route POST /api/auth/login
 * @desc Autenticar usuario
 * @access Public
 */
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validación básica
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email y contraseña son requeridos'
      });
    }

    const result = await loginUser(email.toLowerCase().trim(), password);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(401).json(result);
    }
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * @route POST /api/auth/refresh
 * @desc Refrescar access token
 * @access Public
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token requerido'
      });
    }

    const result = await refreshAccessToken(refreshToken);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(401).json(result);
    }
  } catch (error) {
    console.error('Error refrescando token:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * @route POST /api/auth/logout
 * @desc Cerrar sesión
 * @access Private
 */
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token requerido'
      });
    }

    const result = logoutUser(refreshToken);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error en logout:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * @route GET /api/auth/me
 * @desc Obtener información del usuario autenticado
 * @access Private
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    // La información del usuario ya está disponible en req.user gracias al middleware
    res.status(200).json({
      success: true,
      user: {
        id: req.user.userId,
        email: req.user.email,
        name: req.user.name
      }
    });
  } catch (error) {
    console.error('Error obteniendo información del usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * @route GET /api/auth/validate
 * @desc Validar token de acceso
 * @access Private
 */
router.get('/validate', authenticateToken, async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Token válido',
      user: {
        id: req.user.userId,
        email: req.user.email,
        name: req.user.name
      }
    });
  } catch (error) {
    console.error('Error validando token:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

module.exports = router;