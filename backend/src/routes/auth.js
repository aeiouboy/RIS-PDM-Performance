/**
 * Authentication Routes
 * 
 * Express.js routes for handling OAuth 2.0 authentication flow.
 * Provides endpoints for Azure DevOps OAuth integration.
 * 
 * @author RIS Performance Dashboard Management
 * @version 1.0.0
 */

const express = require('express');
const { body, query, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const AzureOAuthService = require('../services/azureOAuthService');
const GoogleAuthService = require('../services/googleAuthService');
const logger = require('../../utils/logger');

const router = express.Router();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: 'Too many authentication requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

// Initialize OAuth service
let oauthService = null;

// Initialize Google auth service (separate from Azure OAuth)
let googleAuthService = null;

/**
 * Initialize OAuth service with configuration
 * @param {Object} config - OAuth configuration
 */
function initializeOAuthService(config = {}) {
  oauthService = new AzureOAuthService(config);
  logger.info('OAuth service initialized', {
    isConfigured: oauthService.isConfigured(),
    scopes: oauthService.scopes
  });
  return oauthService;
}

/**
 * Initialize Google Identity Services auth with configuration.
 * @param {Object} config - { clientId, jwtSecret, allowedEmailDomain }
 */
function initializeGoogleAuthService(config = {}) {
  googleAuthService = new GoogleAuthService(config);
  logger.info('Google auth service initialized', {
    isConfigured: googleAuthService.isConfigured(),
    allowedEmailDomain: googleAuthService.allowedEmailDomain
  });
  return googleAuthService;
}

/**
 * Middleware to ensure OAuth service is initialized
 */
const ensureOAuthService = (req, res, next) => {
  if (!oauthService) {
    oauthService = new AzureOAuthService();
  }
  next();
};

/**
 * Middleware to ensure Google auth service is initialized.
 */
const ensureGoogleAuthService = (req, res, next) => {
  if (!googleAuthService) {
    googleAuthService = new GoogleAuthService();
  }
  next();
};

/**
 * GET /auth/status
 * Get OAuth service status and configuration
 */
router.get('/status', ensureOAuthService, (req, res) => {
  try {
    const status = oauthService.healthCheck();
    
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error getting OAuth status:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to get OAuth status',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /auth/oauth/authorize
 * Generate OAuth authorization URL
 */
router.get('/oauth/authorize', 
  ensureOAuthService,
  authLimiter,
  [
    query('state').optional().isString().trim()
  ],
  (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
          timestamp: new Date().toISOString()
        });
      }

      if (!oauthService.isConfigured()) {
        return res.status(501).json({
          success: false,
          error: 'OAuth not configured',
          message: 'OAuth 2.0 authentication is not configured. Please set environment variables.',
          timestamp: new Date().toISOString()
        });
      }

      const { state } = req.query;
      const authUrl = oauthService.getAuthorizationUrl(state);

      logger.info('OAuth authorization URL generated', {
        clientId: oauthService.clientId,
        sourceIp: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        data: {
          authorizationUrl: authUrl,
          state: state,
          scopes: oauthService.scopes
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error generating OAuth authorization URL:', error.message);
      
      res.status(500).json({
        success: false,
        error: 'Failed to generate authorization URL',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * POST /auth/oauth/token
 * Exchange authorization code for access token
 */
router.post('/oauth/token',
  ensureOAuthService,
  authLimiter,
  [
    body('code').isString().notEmpty().withMessage('Authorization code is required'),
    body('state').optional().isString().trim()
  ],
  async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
          timestamp: new Date().toISOString()
        });
      }

      if (!oauthService.isConfigured()) {
        return res.status(501).json({
          success: false,
          error: 'OAuth not configured',
          message: 'OAuth 2.0 authentication is not configured.',
          timestamp: new Date().toISOString()
        });
      }

      const { code, state } = req.body;

      logger.info('OAuth token exchange requested', {
        sourceIp: req.ip,
        userAgent: req.get('User-Agent'),
        hasState: !!state
      });

      const tokenResponse = await oauthService.exchangeCodeForToken(code, state);

      // Don't log the actual tokens for security
      logger.info('OAuth token exchange successful', {
        expiresIn: tokenResponse.expiresIn,
        tokenType: tokenResponse.tokenType,
        scope: tokenResponse.scope
      });

      res.json({
        success: true,
        data: {
          tokenType: tokenResponse.tokenType,
          expiresIn: tokenResponse.expiresIn,
          scope: tokenResponse.scope
        },
        message: 'Authentication successful',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('OAuth token exchange failed:', error.message);
      
      res.status(400).json({
        success: false,
        error: 'Token exchange failed',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * POST /auth/logout
 * Clear authentication tokens
 */
router.post('/logout',
  ensureOAuthService,
  (req, res) => {
    try {
      oauthService.clearTokens();

      logger.info('User logged out', {
        sourceIp: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        message: 'Logout successful',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Logout error:', error.message);
      
      res.status(500).json({
        success: false,
        error: 'Logout failed',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * POST /auth/google
 * Verify a Google ID token (credential from Google Identity Services) and
 * issue a backend JWT. Body: { credential: string }.
 */
router.post('/google',
  ensureGoogleAuthService,
  authLimiter,
  [
    body('credential').isString().notEmpty().withMessage('Google credential is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
          timestamp: new Date().toISOString()
        });
      }

      if (!googleAuthService.isConfigured()) {
        return res.status(501).json({
          success: false,
          error: 'Google sign-in not configured',
          message: 'Set GOOGLE_CLIENT_ID and JWT_SECRET environment variables.',
          timestamp: new Date().toISOString()
        });
      }

      const { credential } = req.body;

      let googlePayload;
      try {
        googlePayload = await googleAuthService.verifyGoogleCredential(credential);
      } catch (verifyError) {
        const status = verifyError.code === 'EMAIL_DOMAIN_NOT_ALLOWED' ? 403 : 401;
        logger.warn('Google sign-in rejected', {
          message: verifyError.message,
          code: verifyError.code,
          sourceIp: req.ip
        });
        return res.status(status).json({
          success: false,
          error: status === 403 ? 'Forbidden' : 'Unauthorized',
          message: verifyError.message,
          timestamp: new Date().toISOString()
        });
      }

      const user = googleAuthService.buildAppUser(googlePayload);
      const token = googleAuthService.signAppToken(user);

      logger.info('Google sign-in successful', {
        email: user.email,
        role: user.role,
        sourceIp: req.ip
      });

      return res.json({
        success: true,
        data: { token, user },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Google sign-in error:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Google sign-in failed',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * GET /auth/me
 * Verify the bearer JWT and return the decoded user claims.
 */
router.get('/me',
  ensureGoogleAuthService,
  (req, res) => {
    try {
      const authHeader = req.headers.authorization || '';
      if (!authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Missing bearer token.',
          timestamp: new Date().toISOString()
        });
      }
      const token = authHeader.substring(7).trim();
      if (!token) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Missing bearer token.',
          timestamp: new Date().toISOString()
        });
      }

      if (!googleAuthService.isConfigured()) {
        return res.status(501).json({
          success: false,
          error: 'Auth not configured',
          message: 'JWT_SECRET is not set.',
          timestamp: new Date().toISOString()
        });
      }

      let decoded;
      try {
        decoded = googleAuthService.verifyAppToken(token);
      } catch (verifyError) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Invalid or expired token.',
          timestamp: new Date().toISOString()
        });
      }

      return res.json({
        success: true,
        data: { user: decoded },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('GET /auth/me error:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to resolve current user',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

// Export router and initialization functions
module.exports = {
  router,
  initializeOAuthService,
  initializeGoogleAuthService
};