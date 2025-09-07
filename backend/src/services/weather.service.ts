// backend/src/services/weather.service.ts - REPLACE ENTIRE FILE
import axios from 'axios';

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
  private readonly BASE_URL = 'https://api.open-meteo.com/v1/forecast';

  async getWeatherBatch(coordinates: Array<{lat: number, lng: number, id: number}>): Promise<WeatherData[]> {
    // console.log(`🌤️ Fetching FRESH weather for ${coordinates.length} locations (NO CACHE)...`);
    
    const results: WeatherData[] = [];

    // Always fetch fresh data - NO CACHE
    for (const coord of coordinates) {
      try {
        const weather = await this.fetchFreshWeather(coord.lat, coord.lng);
        results.push(weather);
        
        // console.log(`✅ Fresh weather for ${coord.lat},${coord.lng}: ${weather.temperature}°C, ${weather.humidity}%, ${weather.condition}`);
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 150));
      } catch (error) {
        console.error(`❌ Weather failed for ${coord.lat},${coord.lng}:`, error);
        const defaultWeather = this.createDefaultWeather(coord.lat, coord.lng);
        results.push(defaultWeather);
      }
    }

    return results;
  }

  private async fetchFreshWeather(lat: number, lng: number): Promise<WeatherData> {
    // console.log(`🌐 API CALL: ${lat},${lng}`);
    
    const response = await axios.get(this.BASE_URL, {
      params: {
        latitude: lat.toFixed(4),
        longitude: lng.toFixed(4),
        current: 'temperature_2m,relative_humidity_2m,weather_code',
        timezone: 'auto'
      },
      timeout: 5000,
      headers: {
        'User-Agent': 'WeatherApp/1.0'
      }
    });

    // console.log(`📡 RAW API Response:`, JSON.stringify(response.data, null, 2));

    if (response.data?.current) {
      const current = response.data.current;
      
      const weather: WeatherData = {
        latitude: lat,
        longitude: lng,
        temperature: Math.round(parseFloat(current.temperature_2m) || 25),
        humidity: Math.round(parseFloat(current.relative_humidity_2m) || 60),
        weatherCode: current.weather_code || 0,
        condition: this.mapWeatherCode(current.weather_code || 0),
        lastUpdated: new Date()
      };

      return weather;
    } else {
      throw new Error('Invalid API response structure');
    }
  }

  private createDefaultWeather(lat: number, lng: number): WeatherData {
    // console.log(`⚠️ Using default weather for ${lat},${lng}`);
    return {
      latitude: lat,
      longitude: lng,
      temperature: 25,
      humidity: 60,
      weatherCode: 0,
      condition: 'Clear',
      lastUpdated: new Date()
    };
  }

  private mapWeatherCode(code: number): string {
    if (code === 0) return 'Clear';
    if (code >= 1 && code <= 3) return 'Cloudy';
    if (code >= 51 && code <= 57) return 'Drizzle';
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'Rainy';
    if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return 'Snow';
    return 'Clear';
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