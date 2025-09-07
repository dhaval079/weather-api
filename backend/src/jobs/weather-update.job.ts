// backend/src/jobs/weather-update.job.ts - DISABLED (weather is always fetched fresh)

// Weather update job is disabled since we're fetching weather data fresh on every request
export const scheduleEnhancedWeatherUpdates = () => {
  console.log('⚠️ Weather update job is DISABLED - weather data is fetched fresh on demand');
  console.log('🌤️ All weather requests now get real-time data from Open-Meteo API');
};