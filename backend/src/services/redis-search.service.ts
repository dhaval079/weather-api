import { Redis } from 'ioredis';
import { Property } from '@prisma/client';
import { PropertySearchParams, SearchResult } from '../types/search.types';

export class RedisSearchService {
  private redis: Redis;
  private readonly INDEX_NAME = 'properties_idx';

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async createIndex(): Promise<void> {
    try {
      // Drop existing index if it exists
      await this.redis.call('FT.DROPINDEX', this.INDEX_NAME).catch(() => {});

      // Create new index with schema
      await this.redis.call(
        'FT.CREATE',
        this.INDEX_NAME,
        'ON', 'HASH',
        'PREFIX', '1', 'property:',
        'SCHEMA',
        'id', 'NUMERIC', 'SORTABLE',
        'name', 'TEXT', 'WEIGHT', '2.0',
        'displayName', 'TEXT',
        'city', 'TEXT', 'SORTABLE',
        'displayCity', 'TEXT',
        'state', 'TEXT',
        'displayState', 'TEXT',
        'lat', 'NUMERIC',
        'lng', 'NUMERIC',
        'isActive', 'TAG',
        'temperature', 'NUMERIC',
        'humidity', 'NUMERIC',
        'condition', 'TAG'
      );
      
      console.log('✅ Redis Search index created');
    } catch (error) {
      console.error('❌ Failed to create Redis Search index:', error);
      throw error;
    }
  }

  async indexProperty(property: Property, weather?: any): Promise<void> {
    try {
      const key = `property:${property.id}`;
      const data = {
        id: property.id,
        name: (property.name || '').toLowerCase(),
        displayName: property.name || '',
        city: (property.city || '').toLowerCase(),
        displayCity: property.city || '',
        state: (property.state || '').toLowerCase(),
        displayState: property.state || '',
        lat: property.lat || 0,
        lng: property.lng || 0,
        isActive: property.isActive ? '1' : '0',
        temperature: weather?.temperature || 0,
        humidity: weather?.humidity || 0,
        condition: weather?.condition || ''
      };

      await this.redis.hmset(key, data);
    } catch (error) {
      console.error(`❌ Failed to index property ${property.id}:`, error);
      throw error;
    }
  }

  async bulkIndexProperties(properties: Property[]): Promise<void> {
    if (properties.length === 0) return;

    try {
      const pipeline = this.redis.pipeline();
      
      for (const property of properties) {
        const key = `property:${property.id}`;
        const data = {
          id: property.id,
          name: (property.name || '').toLowerCase(),
          displayName: property.name || '',
          city: (property.city || '').toLowerCase(),
          displayCity: property.city || '',
          state: (property.state || '').toLowerCase(),
          displayState: property.state || '',
          lat: property.lat || 0,
          lng: property.lng || 0,
          isActive: property.isActive ? '1' : '0',
          temperature: 0,
          humidity: 0,
          condition: ''
        };
        pipeline.hmset(key, data);
      }
      
      await pipeline.exec();
      console.log(`✅ Bulk indexed ${properties.length} properties to Redis Search`);
    } catch (error) {
      console.error('❌ Bulk indexing failed:', error);
      throw error;
    }
  }

  async searchProperties(params: PropertySearchParams): Promise<SearchResult> {
    try {
      const query = this.buildQuery(params);
      const sortBy = this.buildSort(params);
      
      const searchArgs = [
        'FT.SEARCH',
        this.INDEX_NAME,
        query,
        'LIMIT',
        params.offset || 0,
        params.limit || 20
      ];

      if (sortBy) {
        searchArgs.push('SORTBY', sortBy.field, sortBy.direction);
      }

      const startTime = Date.now();
      const result = await this.redis.call('FT.SEARCH', this.INDEX_NAME, query, 'LIMIT', params.offset || 0, params.limit || 20) as any[];
      const searchTime = Date.now() - startTime;

      const total = result[0] as number;
      const properties = [];

      // Parse results (Redis returns [count, key1, fields1, key2, fields2, ...])
      for (let i = 1; i < result.length; i += 2) {
        const fields = result[i + 1] as string[];
        const property: any = {};
        
        for (let j = 0; j < fields.length; j += 2) {
          const key = fields[j];
          const value = fields[j + 1];
          
          if (key === 'id' || key === 'lat' || key === 'lng' || key === 'temperature' || key === 'humidity') {
            property[key] = parseFloat(value) || 0;
          } else if (key === 'isActive') {
            property[key] = value === '1';
          } else if (key === 'displayName') {
            property['name'] = value;
          } else if (key === 'displayCity') {
            property['city'] = value;
          } else if (key === 'displayState') {
            property['state'] = value;
          } else if (key !== 'name' && key !== 'city' && key !== 'state') {
            property[key] = value;
          }
        }
        
        properties.push(property);
      }

      return {
        properties,
        total,
        searchTime,
        hasMore: (params.offset || 0) + properties.length < total
      };
    } catch (error) {
      console.error('❌ Redis Search failed:', error);
      throw error;
    }
  }

  private buildQuery(params: PropertySearchParams): string {
    const conditions: string[] = ['@isActive:{1}'];

    if (params.searchText) {
      const cleanQuery = this.escapeQuery(params.searchText.toLowerCase());
      conditions.push(`@name:(*${cleanQuery}*)`);
    }

    if (params.city) {
      const cleanCity = this.escapeQuery(params.city.toLowerCase());
      conditions.push(`@city:(*${cleanCity}*)`);
    }

    if (params.state) {
      const cleanState = this.escapeQuery(params.state.toLowerCase());
      conditions.push(`@state:(*${cleanState}*)`);
    }

    if (params.tempMin !== undefined) {
      conditions.push(`@temperature:[${params.tempMin} +inf]`);
    }

    if (params.tempMax !== undefined) {
      conditions.push(`@temperature:[-inf ${params.tempMax}]`);
    }

    if (params.humidityMin !== undefined) {
      conditions.push(`@humidity:[${params.humidityMin} +inf]`);
    }

    if (params.humidityMax !== undefined) {
      conditions.push(`@humidity:[-inf ${params.humidityMax}]`);
    }

    if (params.weatherCondition) {
      conditions.push(`@condition:{${this.escapeTag(params.weatherCondition)}}`);
    }

    return conditions.length > 0 ? conditions.join(' ') : '*';
  }

  private buildSort(params: PropertySearchParams): { field: string; direction: string } | null {
    if (!params.sortBy) return null;

    const direction = params.sortOrder === 'desc' ? 'DESC' : 'ASC';

    switch (params.sortBy) {
      case 'name':
        return { field: 'name', direction };
      case 'city':
        return { field: 'city', direction };
      default:
        return { field: 'id', direction };
    }
  }

  private escapeQuery(query: string): string {
    return query.replace(/[^a-zA-Z0-9\s]/g, '');
  }

  private escapeTag(tag: string): string {
    return tag.replace(/[,.<>{}[\]"':;!@#$%^&*()+=~|]/g, '\\$&');
  }

  async deleteProperty(propertyId: number): Promise<void> {
    try {
      await this.redis.del(`property:${propertyId}`);
    } catch (error) {
      console.error(`❌ Failed to delete property ${propertyId}:`, error);
    }
  }

  async updatePropertyWeather(propertyId: number, weather: any): Promise<void> {
    try {
      const key = `property:${propertyId}`;
      await this.redis.hmset(key, {
        temperature: weather.temperature || 0,
        humidity: weather.humidity || 0,
        condition: weather.condition || ''
      });
    } catch (error) {
      console.error(`❌ Failed to update weather for property ${propertyId}:`, error);
    }
  }

  async getIndexInfo(): Promise<any> {
    try {
      return await this.redis.call('FT.INFO', this.INDEX_NAME);
    } catch (error) {
      console.error('❌ Failed to get index info:', error);
      return null;
    }
  }
}