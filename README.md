# Weather to Stay or Not

A property search application with real-time weather-based filtering for finding the perfect place to stay.

## Features

- **Property Search** - Search properties by name, city, and state
- **Weather Filters** - Filter by temperature range, humidity, and weather conditions
- **Real-time Data** - Live weather data from Open-Meteo API
- **Optimized Performance** - Redis caching and efficient query processing
- **Responsive UI** - Clean, modern interface with pagination

## Tech Stack

- **Backend**: Node.js, Express, TypeScript, Prisma, Redis
- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **Database**: MySQL
- **Weather API**: Open-Meteo

## Quick Start

1. **Clone and install**
   ```bash
   git clone <repo-url>
   cd warden-test-one
   npm install
   ```

2. **Setup environment**
   ```bash
   cp .env.example .env
   npm run prisma:gen
   ```

3. **Start development servers**
   ```bash
   # Backend (http://localhost:5001)
   cd backend && npm run dev

   # Frontend (http://localhost:3000)  
   cd frontend && npm run dev
   ```

## API Endpoints

- `GET /get-properties` - Search properties with weather filters
- `GET /suggestions` - Property name autocomplete
- `GET /health` - Health check
- `GET /metrics` - Performance metrics

## Weather Filters

- **Temperature**: -20°C to 50°C range
- **Humidity**: 0% to 100% range  
- **Conditions**: Clear, Cloudy, Drizzle, Rainy, Snow

## Environment Variables

```env
DATABASE_URL=mysql://username:password@host:port/database
REDIS_URL=redis://localhost:6379
PORT=5001
```

## Docker

```bash
docker-compose up --build
```

---

Built for Warden's property search platform with weather-aware filtering.