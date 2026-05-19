/**
 * Google Identity Services Authentication
 *
 * Verifies Google ID tokens (issued client-side by Google Identity Services),
 * maps the verified email to an app user using the static team roster, and
 * mints a short-lived backend JWT for the RIS-PDM dashboard.
 *
 * Stateless: no database, no session store. The JWT is the entire session.
 *
 * @author RIS Performance Dashboard Management
 * @version 1.0.0
 */

const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { getRosterEntry } = require('../config/teamRoster');
const logger = require('../../utils/logger').child({ component: 'GoogleAuthService' });

const DEFAULT_ALLOWED_DOMAIN = 'central.co.th';
const APP_TOKEN_EXPIRES_IN = '8h';
const APP_TOKEN_ISSUER = 'ris-pdm';

class GoogleAuthService {
  constructor(config = {}) {
    this.clientId = config.clientId || process.env.GOOGLE_CLIENT_ID;
    this.jwtSecret = config.jwtSecret || process.env.JWT_SECRET;
    this.allowedEmailDomain =
      config.allowedEmailDomain ||
      process.env.ALLOWED_EMAIL_DOMAIN ||
      DEFAULT_ALLOWED_DOMAIN;

    if (!this.clientId) {
      logger.warn('GOOGLE_CLIENT_ID not set — Google sign-in will be unavailable.');
    }
    if (!this.jwtSecret) {
      logger.warn('JWT_SECRET not set — Google sign-in will be unavailable.');
    }

    // Lazily construct the OAuth2Client only when we have a client ID.
    this._oauthClient = this.clientId ? new OAuth2Client(this.clientId) : null;
  }

  /**
   * @returns {boolean} true if the service is fully configured.
   */
  isConfigured() {
    return !!(this.clientId && this.jwtSecret);
  }

  /**
   * Verify a Google ID token (the `credential` returned by GIS on the client).
   * Throws an Error with a user-safe message on any failure.
   *
   * @param {string} credential - Google ID token (JWT).
   * @returns {Promise<Object>} Verified Google payload.
   */
  async verifyGoogleCredential(credential) {
    if (!this.isConfigured()) {
      throw new Error('Google sign-in is not configured on this server.');
    }
    if (!credential || typeof credential !== 'string') {
      throw new Error('Missing Google credential.');
    }

    let ticket;
    try {
      ticket = await this._oauthClient.verifyIdToken({
        idToken: credential,
        audience: this.clientId,
      });
    } catch (error) {
      logger.warn('Google ID token verification failed', { message: error.message });
      throw new Error('Invalid Google credential.');
    }

    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error('Google credential had no payload.');
    }

    if (payload.email_verified !== true) {
      throw new Error('Google account email is not verified.');
    }

    const email = String(payload.email || '').toLowerCase();
    if (!email) {
      throw new Error('Google credential did not include an email.');
    }

    const allowedDomain = this.allowedEmailDomain.toLowerCase();
    if (!email.endsWith(`@${allowedDomain}`)) {
      const err = new Error(`Sign-in restricted to @${allowedDomain} accounts.`);
      err.code = 'EMAIL_DOMAIN_NOT_ALLOWED';
      throw err;
    }

    return payload;
  }

  /**
   * Build the app-side user object from a verified Google payload.
   * Roster lookup wins; out-of-roster but in-domain emails become viewers.
   *
   * @param {Object} googlePayload
   * @returns {Object} App user.
   */
  buildAppUser(googlePayload) {
    const email = String(googlePayload.email || '').toLowerCase();
    const entry = getRosterEntry(email);

    const base = {
      id: googlePayload.sub,
      email,
      avatar: googlePayload.picture || null,
      preferences: {
        theme: 'light',
        notifications: true,
        language: 'en',
      },
      lastLogin: new Date().toISOString(),
    };

    if (entry) {
      return {
        ...base,
        name: entry.name,
        role: entry.role,
        department: entry.department,
        permissions: entry.permissions,
      };
    }

    // In-domain but not in roster — default to viewer.
    return {
      ...base,
      name: googlePayload.name || email,
      role: 'viewer',
      department: '',
      permissions: ['read'],
    };
  }

  /**
   * Sign a short-lived app JWT for the given user.
   * @param {Object} user
   * @returns {string} JWT.
   */
  signAppToken(user) {
    if (!this.jwtSecret) {
      throw new Error('JWT_SECRET not configured.');
    }
    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
        iss: APP_TOKEN_ISSUER,
      },
      this.jwtSecret,
      { expiresIn: APP_TOKEN_EXPIRES_IN }
    );
  }

  /**
   * Verify an app JWT. Throws on failure.
   * @param {string} token
   * @returns {Object} Decoded payload.
   */
  verifyAppToken(token) {
    if (!this.jwtSecret) {
      throw new Error('JWT_SECRET not configured.');
    }
    return jwt.verify(token, this.jwtSecret, { issuer: APP_TOKEN_ISSUER });
  }
}

module.exports = GoogleAuthService;
