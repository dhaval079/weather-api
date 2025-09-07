import "dotenv/config";
import express from "express";
import compression from "compression";
import { getProperties } from "./use-cases/getProperties";
import { cacheService } from "./services/cache.service";
import { prisma } from "./database/prisma";
import { RedisPropertyService } from "./services/redis-property.service";
import { scheduleEnhancedWeatherUpdates } from "./jobs/weather-update.job";

const app = express();
const port = process.env.PORT || 5001;

// ✅ INITIALIZE REDIS SERVICES
const redisPropertyService = new RedisPropertyService();

// Request deduplication cache
const requestCache = new Map();
const CACHE_DURATION = 10000; // Reduced to 10 seconds

// Request deduplication middleware
const deduplicateRequests = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Skip caching for admin endpoints
  if (req.path.startsWith('/admin/')) {
    return next();
  }

  const key = `${req.method}-${req.url}`;
  const cached = requestCache.get(key);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`💨 Request cache hit: ${key}`);
    return res.json(cached.data);
  }
  
  const originalSend = res.json.bind(res);
  res.json = (data: any) => {
    requestCache.set(key, {
      data,
      timestamp: Date.now()
    });
    
    // Clean up old cache entries
    if (requestCache.size > 1000) {
      const cutoff = Date.now() - CACHE_DURATION;
      for (const [cacheKey, cache] of requestCache.entries()) {
        if (cache.timestamp < cutoff) {
          requestCache.delete(cacheKey);
        }
      }
    }
    
    return originalSend(data);
  };
  
  next();
};

// Middleware
app.use(compression({ level: 6 })); // Optimize compression
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(deduplicateRequests);

// CORS for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Cache-Control', 'public, max-age=300'); // 5 minutes browser cache
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Routes
app.get("/", (_req, res) => res.json({ 
  message: "Warden Weather Test: Redis-Only with Weather Caching",
  version: "5.0.0-redis-only",
  features: [
    "redis-only", 
    "cached-weather-data", 
    "parallel-processing", 
    "request-deduplication",
    "optimized-performance"
  ],
  uptime: process.uptime(),
  timestamp: new Date().toISOString()
}));

app.get("/health", async (_req, res) => {
  try {
    // Check all services health
    const [dbHealth, cacheHealth, serviceHealth] = await Promise.all([
      prisma.$queryRaw`SELECT 1 as health`.catch(() => null),
      cacheService.getStats().catch(() => null),
      redisPropertyService.getServiceStats().catch(() => null)
    ]);

    res.json({ 
      status: "healthy", 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: dbHealth ? 'connected' : 'disconnected',
        cache: cacheHealth?.connected ? 'connected' : 'disconnected',
        redis: serviceHealth?.redis ? 'connected' : 'disconnected'
      }
    });
  } catch (error) {
    res.status(500).json({
      status: "unhealthy",
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    });
  }
});

// ✅ MAIN PROPERTIES ENDPOINT
app.get("/get-properties", getProperties);

// Suggestions endpoint for search autocomplete
app.get("/suggestions", async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || typeof q !== 'string' || q.length < 2) {
      return res.json({ success: true, data: [] });
    }

    // Try Redis search first for suggestions
    const suggestions = await redisPropertyService.searchProperties({
      searchText: q
    });

    const formattedSuggestions = suggestions.properties.slice(0, 10).map((p: any) => ({
      id: p.id,
      label: `${p.name} - ${p.city}, ${p.state}`,
      value: p.name,
      city: p.city,
      state: p.state
    }));

    res.json({ 
      success: true,
      data: formattedSuggestions,
      source: suggestions.source
    });
  } catch (error) {
    console.error('Suggestions error:', error);
    res.status(500).json({ success: false, data: [] });
  }
});

// ✅ ENHANCED METRICS ENDPOINT
app.get("/metrics", async (req, res) => {
  try {
    const [totalProperties, activeProperties, cities, states, serviceStats] = await Promise.all([
      prisma.property.count(),
      prisma.property.count({ where: { isActive: true } }),
      prisma.property.groupBy({
        by: ['city'],
        where: { isActive: true },
        _count: true
      }),
      prisma.property.groupBy({
        by: ['state'],
        where: { isActive: true },
        _count: true
      }),
      redisPropertyService.getServiceStats()
    ]);

    res.json({
      success: true,
      data: {
        performance: {
          totalProperties,
          activeProperties,
          citiesCount: cities.length,
          statesCount: states.length,
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          timestamp: new Date().toISOString()
        },
        distribution: {
          topCities: cities
            .sort((a: any, b: any) => b._count - a._count)
            .slice(0, 10)
            .map((c: any) => ({ city: c.city, count: c._count })),
          stateDistribution: states
            .sort((a: any, b: any) => b._count - a._count)
            .map((s: any) => ({ state: s.state, count: s._count }))
        },
        services: serviceStats,
        weather: {
          mode: 'redis-cached',
          message: 'Weather data is cached in Redis for 30 minutes'
        },
        cache: {
          requestCacheSize: requestCache.size,
          requestCacheDuration: CACHE_DURATION
        }
      }
    });
  } catch (error) {
    console.error('Metrics error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch metrics',
      message: (error as Error).message 
    });
  }
});

// ✅ ADMIN ENDPOINTS
app.post("/admin/sync-all", async (req, res) => {
  try {
    console.log('🔄 Starting Redis sync...');
    await redisPropertyService.syncPropertiesToRedis();
    res.json({ 
      success: true, 
      message: "Full sync to Redis completed",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Sync failed:', error);
    res.status(500).json({ 
      success: false, 
      error: "Sync failed",
      message: (error as Error).message 
    });
  }
});

app.post("/admin/sync-weather", async (req, res) => {
  res.json({ 
    success: true, 
    message: "Weather is cached in Redis for 30 minutes - no manual sync needed",
    mode: "redis-cached",
    timestamp: new Date().toISOString()
  });
});

app.delete("/admin/clear-cache", async (req, res) => {
  try {
    await cacheService.flushAll();
    requestCache.clear();
    res.json({ 
      success: true, 
      message: "All caches cleared",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: "Cache clear failed",
      message: (error as Error).message 
    });
  }
});

// ✅ INITIALIZE SERVICES
const initializeServices = async () => {
  try {
    console.log('🚀 Initializing services (Redis-only mode)...');
    
    // Sync property data to Redis
    setTimeout(async () => {
      try {
        console.log('📊 Starting property data sync to Redis...');
        await redisPropertyService.syncPropertiesToRedis();
        console.log('✅ Property data sync completed');
      } catch (error) {
        console.error('❌ Property sync failed:', error);
      }
    }, 3000);

    // Initialize background job (disabled for weather)
    if (process.env.NODE_ENV !== 'test') {
      scheduleEnhancedWeatherUpdates();
      console.log('⏰ Background services initialized (weather job disabled)');
    }

  } catch (error) {
    console.error('❌ Service initialization failed:', error);
  }
};

// Start server
app.listen(port, () => {
  console.log(`🚀 Redis-Only Server running on http://localhost:${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`🏠 Properties API: http://localhost:${port}/get-properties`);
  console.log(`🔍 Suggestions API: http://localhost:${port}/suggestions`);
  console.log(`📈 Metrics API: http://localhost:${port}/metrics`);
  console.log(`🔄 Admin Sync: POST http://localhost:${port}/admin/sync-all`);
  console.log(`🌤️ Weather is CACHED in Redis for 30 minutes!`);
  
  // Initialize services after server starts
  initializeServices();
});

export default app;