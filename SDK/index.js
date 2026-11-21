import axios from 'axios';

class ErrorPulse {
  constructor(config = {}) {
    this.apiKey = config.apiKey || '';
    this.serverUrl = config.serverUrl || 'http://localhost:2000'; 
    this.environment = config.environment || process.env.NODE_ENV || 'development';

    //  Smart Filtering Configuration ---
    // Default to ignoring common operational/auth errors unless overridden
    this.ignoreStatus = config.ignoreStatus || [400, 401, 403, 404]; 
    this.ignoreErrors = config.ignoreErrors || [/jwt expired/i, /invalid credentials/i, /unauthorized/i];
    this.beforeSend = config.beforeSend || null; // Optional custom filter callback

    if (!this.apiKey) {
      console.warn('[ErrorPulse] Warning: No API Key provided. Telemetry disabled.');
    } else {
      this._registerGlobalHandlers();
    }
  }

  static init(config) {
    return new ErrorPulse(config);
  }

  /**
   * Helper: Check if error should be bypassed/ignored
   */
  _shouldBypass(error, context = {}) {
    const errMessage = error instanceof Error ? error.message : String(error);
    const statusCode = context.statusCode || error.statusCode || error.status;

    // 1. Bypass by HTTP Status Code (e.g., 401, 404)
    if (statusCode && this.ignoreStatus.includes(Number(statusCode))) {
      return { bypass: true, reason: `Ignored HTTP Status Code: ${statusCode}` };
    }

    // 2. Bypass by Error Message Pattern (Regex)
    for (const pattern of this.ignoreErrors) {
      if (typeof pattern === 'string' && errMessage.includes(pattern)) {
        return { bypass: true, reason: `Matches ignored string: "${pattern}"` };
      }
      if (pattern instanceof RegExp && pattern.test(errMessage)) {
        return { bypass: true, reason: `Matches ignored regex: ${pattern}` };
      }
    }

    return { bypass: false };
  }

  /**
   * Transmit captured error to the ErrorPulse ingestion endpoint
   */
  async captureException(error, context = {}) {
    if (!this.apiKey) return;

    // --- STEP 1: Pre-Filter Check ---
    const filterResult = this._shouldBypass(error, context);
    if (filterResult.bypass) {
      // Bypassed locally! Zero network request sent.
      return;
    }

    let payload = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : '',
      environment: this.environment,
      route: context.route || 'N/A',
      httpMethod: context.httpMethod || 'N/A',
      headers: context.headers || {},
      userContext: context.userContext || {},
      timestamp: new Date().toISOString(),
    };

    // --- STEP 2: Optional custom beforeSend callback ---
    if (typeof this.beforeSend === 'function') {
      const modifiedPayload = this.beforeSend(payload, error);
      if (!modifiedPayload) {
        // Developer returned null/undefined -> Bypass transmission!
        return;
      }
      payload = modifiedPayload;
    }

    try {
      // Non-blocking fire-and-forget request
      await axios.post(`${this.serverUrl}/api/v1/ingest`, payload, {
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      });
    } catch (err) {
      console.error('[ErrorPulse] Ingestion failed:', err.message);
    }
  }

  _registerGlobalHandlers() {
    process.on('uncaughtException', (error) => {
      console.error('[ErrorPulse] Uncaught Exception Detected:', error.message);
      this.captureException(error);
    });

    process.on('unhandledRejection', (reason) => {
      console.error('[ErrorPulse] Unhandled Rejection Detected:', reason);
      const error = reason instanceof Error ? reason : new Error(String(reason));
      this.captureException(error);
    });
  }

  /**
   * Express Error-Handling Middleware
   */
  expressErrorHandler() {
    return (err, req, res, next) => {
      const statusCode = res.statusCode !== 200 ? res.statusCode : err.status || err.statusCode || 500;

      const context = {
        route: req.originalUrl || req.url || 'UNKNOWN',
        httpMethod: req.method || 'UNKNOWN',
        headers: req.headers || {},
        statusCode: statusCode,
        userContext: req.user ? { id: req.user.id || req.user._id } : {},
      };

      this.captureException(err, context);
      next(err);
    };
  }
}

export { ErrorPulse };
export default ErrorPulse;