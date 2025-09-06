import axios from 'axios';
import { Redis } from 'ioredis';

export interface WeatherData {
  latitude: number;
  longitude: number;
  temperature: number;
  humidity: number;
  weatherCode: number;
  condition: string;
  lastUpdated: Date;
}

export interface WeatherFilters {
  tempMin?: number;
  tempMax?: number;
  humidityMin?: number;
  humidityMax?: number;
  weatherCondition?: string;
}

export class WeatherService {
  private redis: Redis;
  private readonly CACHE_TTL = parseInt(process.env.WEATHER_CACHE_TTL || '1800');
  private readonly BASE_URL = process.env.OPEN_METEO_BASE_URL || 'https://api.open-meteo.com/v1/forecast';

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  async getWeatherBatch(coordinates: Array<{lat: number, lng: number, id: number}>): Promise<WeatherData[]> {
    const cacheKeys = coordinates.map(coord => `weather:${coord.lat}:${coord.lng}`);
    const cachedData = await this.redis.mget(...cacheKeys);
    
    const weatherData: WeatherData[] = [];
    const missingCoords: typeof coordinates = [];

    // Check cache first
    coordinates.forEach((coord, index) => {
      if (cachedData[index]) {
        weatherData.push(JSON.parse(cachedData[index]!));
      } else {
        missingCoords.push(coord);
      }
    });

    // Fetch missing data
    if (missingCoords.length > 0) {
      const freshData = await this.fetchWeatherFromAPI(missingCoords);
      weatherData.push(...freshData);
      
      // Cache the fresh data
      await this.cacheWeatherData(freshData);
    }

    return weatherData;
  }

  private async fetchWeatherFromAPI(coordinates: Array<{lat: number, lng: number}>): Promise<WeatherData[]> {
    const lats = coordinates.map(c => c.lat).join(',');
    const lngs = coordinates.map(c => c.lng).join(',');

    try {
      const response = await axios.get(this.BASE_URL, {
        params: {
          latitude: lats,
          longitude: lngs,
          current: 'temperature_2m,relative_humidity_2m,weather_code',
          timezone: 'auto'
        }
      });

      return this.parseWeatherResponse(response.data, coordinates);
    } catch (error) {
      console.error('Weather API error:', error);
      throw new Error('Failed to fetch weather data');
    }
  }

  private parseWeatherResponse(data: any, coordinates: Array<{lat: number, lng: number}>): WeatherData[] {
    const results: WeatherData[] = [];
    
    if (Array.isArray(data)) {
      // Multiple locations
      data.forEach((location, index) => {
        if (location.current && coordinates[index]) {
          results.push({
            latitude: coordinates[index].lat,
            longitude: coordinates[index].lng,
            temperature: location.current.temperature_2m,
            humidity: location.current.relative_humidity_2m,
            weatherCode: location.current.weather_code,
            condition: this.mapWeatherCode(location.current.weather_code),
            lastUpdated: new Date()
          });
        }
      });
    } else if (data.current) {
      // Single location
      results.push({
        latitude: coordinates[0].lat,
        longitude: coordinates[0].lng,
        temperature: data.current.temperature_2m,
        humidity: data.current.relative_humidity_2m,
        weatherCode: data.current.weather_code,
        condition: this.mapWeatherCode(data.current.weather_code),
        lastUpdated: new Date()
      });
    }

    return results;
  }

  private mapWeatherCode(code: number): string {
    if (code === 0) return 'Clear';
    if (code >= 1 && code <= 3) return 'Cloudy';
    if (code >= 51 && code <= 57) return 'Drizzle';
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'Rainy';
    if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return 'Snow';
    return 'Unknown';
  }

  private async cacheWeatherData(weatherData: WeatherData[]): Promise<void> {
    const pipeline = this.redis.pipeline();
    
    weatherData.forEach(data => {
      const key = `weather:${data.latitude}:${data.longitude}`;
      pipeline.setex(key, this.CACHE_TTL, JSON.stringify(data));
    });
    
    await pipeline.exec();
  }

  async getWeatherByGeohash(geohash: string): Promise<WeatherData | null> {
    try {
      const cacheKey = `weather:geohash:${geohash}`;
      const cached = await this.redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      // In a real implementation, you'd decode the geohash to get lat/lng
      // For now, return null to indicate no weather data available
      return null;
    } catch (error) {
      console.error('Failed to get weather by geohash:', error);
      return null;
    }
  }

  async cacheWeatherByGeohash(geohash: string, weather: WeatherData): Promise<void> {
    try {
      const cacheKey = `weather:geohash:${geohash}`;
      await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(weather));
    } catch (error) {
      console.error('Failed to cache weather by geohash:', error);
    }
  }

  filterByWeather(weatherData: WeatherData[], filters: WeatherFilters): WeatherData[] {
    return weatherData.filter(data => {
      if (filters.tempMin !== undefined && data.temperature < filters.tempMin) return false;
      if (filters.tempMax !== undefined && data.temperature > filters.tempMax) return false;
      if (filters.humidityMin !== undefined && data.humidity < filters.humidityMin) return false;
      if (filters.humidityMax !== undefined && data.humidity > filters.humidityMax) return false;
      if (filters.weatherCondition && data.condition !== filters.weatherCondition) return false;
      return true;
    });
  }
}