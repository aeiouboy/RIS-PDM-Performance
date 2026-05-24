const { Client } = require('@azure/msal-node');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

// MSAL configuration
const msalConfig = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID,
    clientSecret: process.env.AZURE_CLIENT_SECRET,
    authority: process.env.AZURE_AUTHORITY || `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
  },
};

// const msalInstance = new Client(msalConfig); // Commented out - not used in current implementation

/**
 * Authentication middleware for Azure AD
 * Validates Bearer tokens from Azure AD
 */
// Dev-only synthetic user used when no valid token is supplied on localhost.
const DEV_BYPASS_USER = {
  id: 'dev-user',
  email: 'dev@localhost',
  name: 'Dev User',
  department: 'Engineering',
  roles: ['admin'],
  permissions: ['read', 'write', 'admin'],
};
let _warnedAuthBypass = false;

const authMiddleware = async (req, res, next) => {
  try {
    // DEV-ONLY auth bypass — active ONLY when NODE_ENV === 'development' (localhost).
    // Railway/production runs NODE_ENV=production, so this entire block is dead there
    // and the original production auth path below is reached unchanged.
    // A real Bearer token is still honored when present; only its absence/invalidity
    // falls back to a synthetic dev user so you don't need the Google login locally.
    if (process.env.NODE_ENV === 'development') {
      const h = req.headers.authorization;
      const devToken = h && h.startsWith('Bearer ') ? h.substring(7) : null;
      if (devToken) {
        const r = await validateAzureToken(devToken);
        if (r.valid) {
          req.user = r.user;
          req.token = devToken;
          return next();
        }
      }
      if (!_warnedAuthBypass) {
        logger.warn('⚠️  AUTH BYPASS ACTIVE (NODE_ENV=development): unauthenticated requests are treated as dev-user. This NEVER runs in production.');
        _warnedAuthBypass = true;
      }
      req.user = DEV_BYPASS_USER;
      req.token = 'dev-bypass';
      return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: 'Authorization header missing',
        code: 'MISSING_AUTH_HEADER',
        timestamp: new Date().toISOString(),
      });
    }

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Invalid authorization header format',
        code: 'INVALID_AUTH_FORMAT',
        timestamp: new Date().toISOString(),
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      return res.status(401).json({
        error: 'Token missing',
        code: 'MISSING_TOKEN',
        timestamp: new Date().toISOString(),
      });
    }

    // Validate token with Azure AD
    const tokenValidationResult = await validateAzureToken(token);

    if (!tokenValidationResult.valid) {
      return res.status(401).json({
        error: tokenValidationResult.error || 'Invalid token',
        code: 'TOKEN_VALIDATION_FAILED',
        timestamp: new Date().toISOString(),
      });
    }

    // Attach user information to request
    req.user = tokenValidationResult.user;
    req.token = token;

    logger.info(`User authenticated: ${req.user.email}`, {
      userId: req.user.id,
      email: req.user.email,
      path: req.originalUrl,
    });

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(500).json({
      error: 'Authentication service error',
      code: 'AUTH_SERVICE_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Validate Azure AD token
 * @param {string} token - The Bearer token to validate
 * @returns {Object} Validation result with user information
 */
async function validateAzureToken(token) {
  // First, try to verify the token as our own app JWT (issued by the
  // Google sign-in flow). This is the common path now.
  if (process.env.JWT_SECRET) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, { issuer: 'ris-pdm' });
      return {
        valid: true,
        user: {
          id: decoded.sub,
          email: decoded.email,
          // Prefer the display name embedded in the JWT (set by googleAuthService
          // .signAppToken); fall back to email for tokens minted before that field
          // was added.
          name: decoded.name || decoded.email,
          department: decoded.department || '',
          avatar: decoded.avatar || null,
          roles: decoded.role ? [decoded.role] : [],
          permissions: decoded.permissions || [],
        },
      };
    } catch (jwtError) {
      // Not our JWT — fall through to legacy Azure base64 decode below.
    }
  }

  try {
    // In a real implementation, you would validate the token with Azure AD
    // This is a simplified version for demonstration

    // For now, we'll decode the token and extract user information
    // In production, use proper JWT validation with Azure AD public keys
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

    // Check token expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return {
        valid: false,
        error: 'Token expired',
      };
    }

    // Extract user information from token claims
    const user = {
      id: payload.oid || payload.sub,
      email: payload.email || payload.preferred_username,
      name: payload.name,
      roles: payload.roles || [],
      tenantId: payload.tid,
    };

    return {
      valid: true,
      user,
    };
  } catch (error) {
    logger.error('Token validation error:', error);
    return {
      valid: false,
      error: 'Invalid token format',
    };
  }
}

/**
 * Role-based authorization middleware
 * @param {string[]} allowedRoles - Array of allowed roles
 * @returns {Function} Middleware function
 */
const requireRoles = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'User not authenticated',
        code: 'NOT_AUTHENTICATED',
        timestamp: new Date().toISOString(),
      });
    }

    const userRoles = req.user.roles || [];
    const hasRequiredRole = allowedRoles.some(role => userRoles.includes(role));

    if (!hasRequiredRole) {
      logger.warn(`Access denied for user ${req.user.email}`, {
        userId: req.user.id,
        userRoles,
        requiredRoles: allowedRoles,
        path: req.originalUrl,
      });

      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredRoles: allowedRoles,
        timestamp: new Date().toISOString(),
      });
    }

    next();
  };
};

module.exports = {
  authMiddleware,
  requireRoles,
  validateAzureToken,
};