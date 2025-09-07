import { redis } from './redis.service';

export class CacheService {
  private readonly DEFAULT_TTL = 7200; // 2 hours

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl: number = this.DEFAULT_TTL): Promise<boolean> {
    try {
      await redis.setex(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      await redis.del(key);
      return true;
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  // Weather cache helpers
  getCacheKey(prefix: string, ...parts: (string | number)[]): string {
    return `${prefix}:${parts.join(':')}`;
  }

  async getWeatherCache(lat: number, lng: number): Promise<any | null> {
    const key = this.getCacheKey('weather', lat, lng);
    return this.get(key);
  }

  async setWeatherCache(lat: number, lng: number, data: any, ttl: number = 1800): Promise<boolean> {
    const key = this.getCacheKey('weather', lat, lng);
    return this.set(key, data, ttl);
  }

  // Property search cache
  async getSearchCache(searchKey: string): Promise<any | null> {
    const key = this.getCacheKey('search', searchKey);
    return this.get(key);
  }

  async setSearchCache(searchKey: string, data: any, ttl: number = 900): Promise<boolean> {
    const key = this.getCacheKey('search', searchKey);
    return this.set(key, data, ttl);
  }

  // Clear all cache
  async flushAll(): Promise<boolean> {
    try {
      await redis.flushall();
      return true;
    } catch (error) {
      console.error('Cache flush error:', error);
      return false;
    }
  }

  // Get cache stats
  async getStats(): Promise<any> {
    try {
      const info = await redis.info();
      return {
        connected: true,
        info: info
      };
    } catch (error) {
      return {
        connected: false,
        error: (error as Error).message
      };
    }
  }
}

export const cacheService = new CacheService();