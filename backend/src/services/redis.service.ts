import { Redis } from 'ioredis';

export class RedisConnection {
  private static instance: Redis;

  public static getInstance(): Redis {
    if (!RedisConnection.instance) {
      RedisConnection.instance = RedisConnection.createConnection();
    }
    return RedisConnection.instance;
  }

  private static createConnection(): Redis {
    const redisUrl = process.env.REDIS_URL || process.env.REDIS_URL || '';
    
    const redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      connectTimeout: 10000,
      commandTimeout: 5000,
      family: 4,
      keepAlive: 30000,
      enableReadyCheck: true,
      lazyConnect: false,
      db: 0,
      enableOfflineQueue: false,
      connectionName: 'warden-app'
    });

    redis.on('connect', () => {
      console.log('✅ Connected to Redis (ElastiCache)');
    });

    redis.on('error', (error) => {
      console.error('❌ Redis connection error:', error);
    });

    redis.on('ready', () => {
      console.log('🚀 Redis is ready to receive commands');
    });

    return redis;
  }

  public static async close(): Promise<void> {
    if (RedisConnection.instance) {
      await RedisConnection.instance.quit();
    }
  }
}

// Export singleton instance
export const redis = RedisConnection.getInstance();