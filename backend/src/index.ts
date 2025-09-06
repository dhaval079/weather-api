import "dotenv/config";
import express from "express";
import { getProperties } from "./use-cases/getProperties";
import { scheduleWeatherUpdates } from "./jobs/weather-update.job";
import { PropertyService } from "./services/property.service";

const app = express();
const port = process.env.PORT || 5000;
const propertyService = new PropertyService();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Routes
app.get("/", (_req, res) => res.json({ 
  message: "Warden Weather Test: OK",
  version: "2.0.0",
  features: ["weather-filtering", "caching", "background-jobs"]
}));

app.get("/health", (_req, res) => res.json({ 
  status: "healthy", 
  timestamp: new Date().toISOString(),
  uptime: process.uptime()
}));

app.get("/get-properties", getProperties);

// Sync endpoint for Redis Search
app.post("/admin/sync-redis", async (req, res) => {
  try {
    await propertyService.syncToRedisSearch();
    res.json({ success: true, message: "Redis Search sync completed" });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: "Sync failed",
      message: (error as Error).message 
    });
  }
});

// Start background jobs
if (process.env.NODE_ENV !== 'test') {
  scheduleWeatherUpdates();
  console.log('Background weather update jobs scheduled');
}

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`🏠 Properties API: http://localhost:${port}/get-properties`);
});

export default app;