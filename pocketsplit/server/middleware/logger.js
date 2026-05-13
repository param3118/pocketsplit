/**
 * Simple structured JSON logger middleware.
 * In production, logs should be machine-readable (JSON) for tools like Datadog/ELK.
 */
const logger = (req, res, next) => {
  const start = Date.now();
  
  // Hook into the finish event to log once the request is done
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    };

    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify(logData));
    } else {
      // Cleaner logs for development
      console.log(`[${logData.timestamp}] ${logData.method} ${logData.url} ${logData.status} - ${logData.duration}`);
    }
  });

  next();
};

module.exports = { logger };
