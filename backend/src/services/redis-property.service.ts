import { prisma } from '../database/prisma';
import { redis } from './redis.service';
import { WeatherService, WeatherData, WeatherFilters } from './weather.service';

export interface EnhancedSearchFilters extends WeatherFilters {
  searchText?: string;
  city?: string;
  state?: string;
  limit?: number;
  offset?: number;
}

export interface PropertyWithWeather {
  id: number;
  name: string;
  city: string;
  state: string;
  country: string;
  lat: number;
  lng: number;
  isActive: boolean;
  tags: string[];
  weather?: {
    temperature: number;
    humidity: number;
    condition: string;
    lastUpdated: Date;
  };
}

export class RedisPropertyService {
  private weatherService: WeatherService;
  private readonly PROPERTIES_KEY = 'properties:all';
  private readonly WEATHER_KEY_PREFIX = 'weather:';
  private readonly WEATHER_CACHE_TTL = 1800; // 30 minutes

  constructor() {
    this.weatherService = new WeatherService();
    this.initializeService();
  }

  private async initializeService(): Promise<void> {
    try {
      console.log('🚀 Initializing Redis Property Service...');
      await this.syncPropertiesToRedis();
      console.log('✅ Redis Property Service initialized');
    } catch (error) {
      console.error('❌ Redis Property Service initialization failed:', error);
    }
  }

  async syncPropertiesToRedis(): Promise<void> {
    try {
      console.log('📊 Syncing all properties to Redis...');
      
      const properties = await prisma.property.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' }
      });

      const redisData = properties.map(prop => ({
        id: prop.id,
        name: prop.name,
        city: prop.city || '',
        state: prop.state || '',
        country: prop.country || 'India',
        lat: prop.lat || 0,
        lng: prop.lng || 0,
        isActive: prop.isActive,
        tags: Array.isArray(prop.tags) ? prop.tags.filter((tag): tag is string => typeof tag === 'string') : []
      }));

      await redis.set(this.PROPERTIES_KEY, JSON.stringify(redisData), 'EX', 3600); // 1 hour cache
      console.log(`✅ Synced ${properties.length} properties to Redis`);
    } catch (error) {
      console.error('❌ Failed to sync properties to Redis:', error);
    }
  }

  async searchProperties(filters: EnhancedSearchFilters): Promise<{
    properties: PropertyWithWeather[];
    total: number;
    hasMore: boolean;
    searchTime: number;
    source: string;
  }> {
    try {
      const startTime = Date.now();

      // Get properties from Redis
      const cachedProperties = await redis.get(this.PROPERTIES_KEY);
      let properties: any[] = [];

      if (cachedProperties) {
        properties = JSON.parse(cachedProperties);
        console.log(`📊 Loaded ${properties.length} properties from Redis cache`);
      } else {
        // Fallback to database if Redis cache is empty
        console.log('⚠️ Redis cache empty, loading from database...');
        await this.syncPropertiesToRedis();
        const freshCache = await redis.get(this.PROPERTIES_KEY);
        properties = freshCache ? JSON.parse(freshCache) : [];
      }

      // Apply basic filters
      let filteredProperties = properties.filter(prop => {
        if (filters.searchText && !prop.name.toLowerCase().includes(filters.searchText.toLowerCase())) return false;
        if (filters.city && !prop.city.toLowerCase().includes(filters.city.toLowerCase())) return false;
        if (filters.state && !prop.state.toLowerCase().includes(filters.state.toLowerCase())) return false;
        return true;
      });

      console.log(`🔍 After basic filtering: ${filteredProperties.length} properties`);

      // For efficient pagination, we need to apply weather filters first to get accurate totals
      // But only fetch weather for the current page to optimize performance
      let weatherFilteredProperties = filteredProperties;
      let totalWithoutWeatherFilters = filteredProperties.length;

      // If weather filters are applied, we need to get weather for all to filter correctly
      const hasWeatherFilters = filters.tempMin !== undefined || filters.tempMax !== undefined || 
                               filters.humidityMin !== undefined || filters.humidityMax !== undefined ||
                               filters.weatherCondition !== undefined;

      if (hasWeatherFilters) {
        // Get weather for all filtered properties to apply weather filters
        console.log('🌡️ Weather filters detected, fetching weather for all properties...');
        const allWithWeather = await this.attachWeatherData(filteredProperties);
        weatherFilteredProperties = this.applyWeatherFilters(allWithWeather, filters);
        console.log(`🔍 After weather filtering: ${weatherFilteredProperties.length} properties`);
      }

      // Apply pagination to the final filtered results
      const limit = filters.limit || 20;
      const offset = filters.offset || 0;
      const paginatedProperties = weatherFilteredProperties.slice(offset, offset + limit);
      
      // If no weather filters were applied, fetch weather only for the current page
      let finalProperties: PropertyWithWeather[];
      if (hasWeatherFilters) {
        finalProperties = paginatedProperties;
      } else {
        finalProperties = await this.attachWeatherData(paginatedProperties);
      }

      const total = weatherFilteredProperties.length;
      const hasMore = offset + limit < total;

      const searchTime = Date.now() - startTime;
      console.log(`🚀 Redis search completed in ${searchTime}ms - Page ${Math.floor(offset/limit) + 1} (${finalProperties.length}/${total})`);

      return {
        properties: finalProperties,
        total,
        hasMore,
        searchTime,
        source: 'redis_with_weather_cache'
      };
    } catch (error) {
      console.error('❌ Redis property search failed:', error);
      throw error;
    }
  }

  private async attachWeatherData(properties: any[]): Promise<PropertyWithWeather[]> {
    const weatherPromises = properties.map(async (prop) => {
      if (!prop.lat || !prop.lng) {
        return {
          ...prop,
          weather: {
            temperature: 25,
            humidity: 60,
            condition: 'Clear',
            lastUpdated: new Date()
          }
        };
      }

      const weatherKey = `${this.WEATHER_KEY_PREFIX}${prop.lat.toFixed(4)},${prop.lng.toFixed(4)}`;
      
      // Try to get weather from Redis cache
      const cachedWeather = await redis.get(weatherKey);
      if (cachedWeather) {
        const weather = JSON.parse(cachedWeather);
        return {
          ...prop,
          weather: {
            temperature: weather.temperature,
            humidity: weather.humidity,
            condition: weather.condition,
            lastUpdated: new Date(weather.lastUpdated)
          }
        };
      }

      // If not cached, fetch fresh weather and cache it
      try {
        const freshWeather = await this.weatherService.getWeatherBatch([{
          id: prop.id,
          lat: prop.lat,
          lng: prop.lng
        }]);

        if (freshWeather.length > 0) {
          const weather = freshWeather[0];
          
          // Cache the weather data
          await redis.set(
            weatherKey,
            JSON.stringify({
              temperature: weather.temperature,
              humidity: weather.humidity,
              condition: weather.condition,
              lastUpdated: weather.lastUpdated
            }),
            'EX',
            this.WEATHER_CACHE_TTL
          );

          return {
            ...prop,
            weather: {
              temperature: weather.temperature,
              humidity: weather.humidity,
              condition: weather.condition,
              lastUpdated: weather.lastUpdated
            }
          };
        }
      } catch (error) {
        console.error(`❌ Weather fetch failed for ${prop.id}:`, error);
      }

      // Default weather if fetch fails
      return {
        ...prop,
        weather: {
          temperature: 25,
          humidity: 60,
          condition: 'Clear',
          lastUpdated: new Date()
        }
      };
    });

    // Process weather requests in parallel batches of 10 to avoid overwhelming the API
    const batchSize = 10;
    const results: PropertyWithWeather[] = [];
    
    for (let i = 0; i < weatherPromises.length; i += batchSize) {
      const batch = weatherPromises.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch);
      results.push(...batchResults);
      
      // Small delay between batches
      if (i + batchSize < weatherPromises.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  private applyWeatherFilters(properties: PropertyWithWeather[], filters: WeatherFilters): PropertyWithWeather[] {
    if (!filters.tempMin && !filters.tempMax && !filters.humidityMin && !filters.humidityMax && !filters.weatherCondition) {
      return properties;
    }

    return properties.filter(prop => {
      if (!prop.weather) return false;
      
      if (filters.tempMin !== undefined && prop.weather.temperature < filters.tempMin) return false;
      if (filters.tempMax !== undefined && prop.weather.temperature > filters.tempMax) return false;
      if (filters.humidityMin !== undefined && prop.weather.humidity < filters.humidityMin) return false;
      if (filters.humidityMax !== undefined && prop.weather.humidity > filters.humidityMax) return false;
      if (filters.weatherCondition && prop.weather.condition !== filters.weatherCondition) return false;
      
      return true;
    });
  }

  async getServiceStats(): Promise<any> {
    try {
      const cachedProperties = await redis.get(this.PROPERTIES_KEY);
      const propertyCount = cachedProperties ? JSON.parse(cachedProperties).length : 0;
      
      // Get weather cache count
      const weatherKeys = await redis.keys(`${this.WEATHER_KEY_PREFIX}*`);
      
      return {
        redis: {
          properties_cached: propertyCount,
          weather_cache_count: weatherKeys.length,
          connection_status: 'connected'
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Failed to get Redis service stats:', error);
      return {
        redis: {
          connection_status: 'error',
          error: (error as Error).message
        },
        timestamp: new Date().toISOString()
      };
    }
  }
}