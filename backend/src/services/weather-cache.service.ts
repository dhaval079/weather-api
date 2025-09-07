// backend/src/services/weather-cache.service.ts - Deprecated service (weather always fresh)
export class WeatherCacheService {
  constructor() {
    console.log('⚠️ WeatherCacheService is deprecated - weather is always fetched fresh now');
  }

  async updatePropertyWeather(propertyId: number, lat: number, lng: number): Promise<void> {
    console.log('⚠️ WeatherCacheService.updatePropertyWeather is deprecated - weather is fetched fresh on demand');
  }

  async updateAllPropertiesWeather(properties: Array<{id: number, lat: number, lng: number}>): Promise<void> {
    console.log('⚠️ WeatherCacheService.updateAllPropertiesWeather is deprecated - weather is fetched fresh on demand');
  }

  async getPropertyWeather(propertyId: number): Promise<any | null> {
    console.log('⚠️ WeatherCacheService.getPropertyWeather is deprecated - weather is fetched fresh on demand');
    return null;
  }

  async getAllCachedWeather(): Promise<any[]> {
    console.log('⚠️ WeatherCacheService.getAllCachedWeather is deprecated - weather is fetched fresh on demand');
    return [];
  }

  async getWeatherStats(): Promise<any> {
    return {
      totalWeatherEntries: 0,
      cacheStatus: 'disabled',
      lastUpdated: new Date(),
      cacheTTL: 0,
      mode: 'always-fresh',
      message: 'Weather caching is disabled - always fetching fresh data on demand'
    };
  }
}