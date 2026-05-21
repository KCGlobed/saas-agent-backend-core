const AuditLog = require('../models/AuditLog');

// Helper to mask sensitive fields in objects
const maskSensitiveData = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  
  const maskedObj = Array.isArray(obj) ? [] : {};
  const sensitiveKeys = ['password', 'token', 'encryptedToken', 'encryptedPassword', 'uri', 'encryptedUri', 'client_secret'];

  for (const key in obj) {
    if (sensitiveKeys.includes(key.toLowerCase()) || sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      maskedObj[key] = '[MASKED]';
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      maskedObj[key] = maskSensitiveData(obj[key]);
    } else {
      maskedObj[key] = obj[key];
    }
  }
  return maskedObj;
};

const auditLogger = (req, res, next) => {
  // Capture original functions
  const originalSend = res.send;
  const originalJson = res.json;
  
  let responseBody = null;

  // Override send
  res.send = function (body) {
    responseBody = body;
    return originalSend.apply(this, arguments);
  };

  // Override json
  res.json = function (body) {
    responseBody = body;
    return originalJson.apply(this, arguments);
  };

  res.on('finish', async () => {
    try {
      // Don't log GET requests to keep the noise down, unless it's a specific action
      // Or we can just log all POST/PUT/PATCH/DELETE
      if (req.method === 'GET' && !req.originalUrl.includes('/connect/')) {
         // return; 
         // Optional: If we want everything, remove the return
      }
      
      let parsedResponse = responseBody;
      try {
        if (typeof responseBody === 'string') {
          parsedResponse = JSON.parse(responseBody);
        }
      } catch (e) {
        // Not JSON
      }

      const isError = res.statusCode >= 400;
      
      // Try to extract exact error message if any
      let errorMessage = null;
      if (isError && parsedResponse) {
          errorMessage = parsedResponse.details || parsedResponse.error || parsedResponse.message || 'Unknown Error';
      }

      const logEntry = new AuditLog({
        userId: req.user ? req.user.id : null,
        userEmail: req.user ? req.user.email : null,
        action: `${req.method} ${req.originalUrl.split('?')[0]}`,
        method: req.method,
        endpoint: req.originalUrl,
        status: isError ? 'ERROR' : 'SUCCESS',
        statusCode: res.statusCode,
        payload: req.body ? maskSensitiveData(req.body) : null,
        response: maskSensitiveData(parsedResponse),
        errorMessage: errorMessage,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent')
      });

      await logEntry.save();
    } catch (err) {
      console.error('Error in auditLogger middleware:', err);
    }
  });

  next();
};

module.exports = auditLogger;
