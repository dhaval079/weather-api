import { Property } from '@prisma/client';
import { prisma } from '../database/prisma';
import { WeatherService, WeatherData, WeatherFilters } from './weather.service';
import { RedisSearchService } from './redis-search.service';
import { Redis } from 'ioredis';

export interface PropertyWithWeather extends Property {
  weather?: WeatherData;
}

export interface SearchFilters extends WeatherFilters {
  searchText?: string;
  city?: string;
  state?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export class PropertyService {
  private weatherService: WeatherService;
  private redisSearchService: RedisSearchService;
  private redis: Redis;

  constructor() {
    this.weatherService = new WeatherService();
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.redisSearchService = new RedisSearchService(this.redis);
  }

  async searchProperties(filters: SearchFilters): Promise<{
    properties: PropertyWithWeather[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      // Use database for now (Redis Search causes auth issues with cloud Redis)
      return await this.searchWithDatabase(filters);
    } catch (error) {
      console.error('Search failed:', error);
      throw error;
    }
  }

  private async searchWithRedisSearch(filters: SearchFilters): Promise<{
    properties: PropertyWithWeather[];
    total: number;
    hasMore: boolean;
  }> {
    const result = await this.redisSearchService.searchProperties({
      searchText: filters.searchText,
      city: filters.city,
      state: filters.state,
      tempMin: filters.tempMin,
      tempMax: filters.tempMax,
      humidityMin: filters.humidityMin,
      humidityMax: filters.humidityMax,
      weatherCondition: filters.weatherCondition,
      limit: filters.limit,
      offset: filters.offset
    });

    return {
      properties: result.properties,
      total: result.total,
      hasMore: result.hasMore
    };
  }

  private async searchWithDatabase(filters: SearchFilters): Promise<{
    properties: PropertyWithWeather[];
    total: number;
    hasMore: boolean;
  }> {
    const where: any = { isActive: true };
    const limit = filters.limit || 20;
    const offset = filters.offset || 0;

    if (filters.searchText) {
      where.name = { contains: filters.searchText };
    }
    if (filters.city) {
      where.city = filters.city;
    }
    if (filters.state) {
      where.state = filters.state;
    }

    if (this.hasWeatherFilters(filters)) {
      const allProperties = await prisma.property.findMany({
        where,
        orderBy: { name: 'asc' }
      });

      const propertiesWithWeather = await this.addWeatherData(allProperties, filters);
      const filteredProperties = this.applyWeatherFilters(propertiesWithWeather, filters);
      
      const paginatedProperties = filteredProperties.slice(offset, offset + limit);
      
      return {
        properties: paginatedProperties,
        total: filteredProperties.length,
        hasMore: offset + limit < filteredProperties.length
      };
    } else {
      const [properties, total] = await Promise.all([
        prisma.property.findMany({
          where,
          take: limit,
          skip: offset,
          orderBy: { name: 'asc' }
        }),
        prisma.property.count({ where })
      ]);

      const propertiesWithWeather = await this.addWeatherData(properties, filters);

      return {
        properties: propertiesWithWeather,
        total: total,
        hasMore: offset + limit < total
      };
    }
  }

  private async addWeatherData(properties: Property[], filters: SearchFilters): Promise<PropertyWithWeather[]> {
    if (properties.length === 0) return [];

    try {
      // Get weather for all properties
      const coordinates = properties
        .filter(p => p.lat && p.lng)
        .map(p => ({ lat: p.lat!, lng: p.lng!, id: p.id }));

      if (coordinates.length === 0) {
        return properties.map(p => ({ ...p, weather: undefined }));
      }

      const weatherData = await this.weatherService.getWeatherBatch(coordinates);
      const weatherMap = new Map(weatherData.map(w => [w.latitude + ',' + w.longitude, w]));

      return properties.map(property => {
        const weather = property.lat && property.lng 
          ? weatherMap.get(property.lat + ',' + property.lng)
          : undefined;
        return { ...property, weather };
      });
    } catch (error) {
      console.error('Failed to add weather data:', error);
      return properties.map(p => ({ ...p, weather: undefined }));
    }
  }

  private applyWeatherFilters(properties: PropertyWithWeather[], filters: SearchFilters): PropertyWithWeather[] {
    return properties.filter(property => {
      if (!property.weather) {
        return !this.hasWeatherFilters(filters);
      }

      const weather = property.weather;

      if (filters.tempMin !== undefined && filters.tempMin !== null && !isNaN(filters.tempMin)) {
        if (weather.temperature < filters.tempMin) {
          return false;
        }
      }
      if (filters.tempMax !== undefined && filters.tempMax !== null && !isNaN(filters.tempMax)) {
        if (weather.temperature > filters.tempMax) {
          return false;
        }
      }

      if (filters.humidityMin !== undefined && filters.humidityMin !== null && !isNaN(filters.humidityMin)) {
        if (weather.humidity < filters.humidityMin) {
          return false;
        }
      }
      if (filters.humidityMax !== undefined && filters.humidityMax !== null && !isNaN(filters.humidityMax)) {
        if (weather.humidity > filters.humidityMax) {
          return false;
        }
      }

      if (filters.weatherCondition && filters.weatherCondition.trim() !== '') {
        if (weather.condition !== filters.weatherCondition) {
          return false;
        }
      }

      return true;
    });
  }

  private hasWeatherFilters(filters: SearchFilters): boolean {
    return !!(
      (filters.tempMin !== undefined && filters.tempMin !== null && !isNaN(filters.tempMin)) ||
      (filters.tempMax !== undefined && filters.tempMax !== null && !isNaN(filters.tempMax)) ||
      (filters.humidityMin !== undefined && filters.humidityMin !== null && !isNaN(filters.humidityMin)) ||
      (filters.humidityMax !== undefined && filters.humidityMax !== null && !isNaN(filters.humidityMax)) ||
      (filters.weatherCondition && filters.weatherCondition.trim() !== '')
    );
  }

  async syncToRedisSearch(): Promise<void> {
    try {
      await this.redisSearchService.createIndex();
      
      let offset = 0;
      const batchSize = 1000;

      while (true) {
        const properties = await prisma.property.findMany({
          where: { isActive: true },
          take: batchSize,
          skip: offset,
          orderBy: { id: 'asc' }
        });

        if (properties.length === 0) break;

        await this.redisSearchService.bulkIndexProperties(properties);
        offset += properties.length;
        
        console.log(`Synced ${offset} properties to Redis Search`);
      }

      console.log('Redis Search sync complete');
    } catch (error) {
      console.error('Redis Search sync failed:', error);
      throw error;
    }
  }
}