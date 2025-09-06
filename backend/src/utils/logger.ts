export class Logger {
  static info(message: string, data?: any) {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, data || '');
  }

  static warn(message: string, data?: any) {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, data || '');
  }

  static error(message: string, error?: any) {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error || '');
    
    // In production, send to error tracking service
    if (process.env.NODE_ENV === 'production') {
      this.trackError(message, error);
    }
  }

  private static trackError(message: string, error: any) {
    // Simple error tracking - in production use Sentry, DataDog, etc.
    const errorData = {
      message,
      error: error?.message || error,
      stack: error?.stack,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
    };
    
    // Log to file or external service
    console.error('TRACKED_ERROR:', JSON.stringify(errorData));
  }
}