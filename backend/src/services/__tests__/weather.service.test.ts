import { WeatherService } from '../weather.service';
import Redis from 'ioredis';
import axios from 'axios';

jest.mock('ioredis');
jest.mock('axios');

const mockRedis = {
  mget: jest.fn(),
  setex: jest.fn(),
  pipeline: jest.fn(() => ({ exec: jest.fn() })),
} as any;

describe('WeatherService', () => {
  let weatherService: WeatherService;

  beforeEach(() => {
    (Redis as any).mockImplementation(() => mockRedis);
    weatherService = new WeatherService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getWeatherBatch', () => {
    it('should return cached data when available', async () => {
      const coordinates = [{ lat: 13.0827, lng: 80.2707, id: 1 }];
      const cachedWeather = JSON.stringify({
        latitude: 13.0827,
        longitude: 80.2707,
        temperature: 28,
        humidity: 75,
        condition: 'Clear'
      });

      mockRedis.mget.mockResolvedValue([cachedWeather]);

      const result = await weatherService.getWeatherBatch(coordinates);

      expect(result).toHaveLength(1);
      expect(result[0].temperature).toBe(28);
      expect(mockRedis.mget).toHaveBeenCalledWith('weather:13.0827:80.2707');
    });

    it('should fetch fresh data when cache miss', async () => {
      const coordinates = [{ lat: 13.0827, lng: 80.2707, id: 1 }];
      
      mockRedis.mget.mockResolvedValue([null]);
      (axios.get as jest.Mock).mockResolvedValue({
        data: {
          current: {
            temperature_2m: 30,
            relative_humidity_2m: 80,
            weather_code: 0
          }
        }
      });

      const result = await weatherService.getWeatherBatch(coordinates);

      expect(result).toHaveLength(1);
      expect(result[0].temperature).toBe(30);
      expect(axios.get).toHaveBeenCalled();
    });
  });

  describe('filterByWeather', () => {
    it('should filter by temperature range', () => {
      const weatherData = [
        { temperature: 25, humidity: 60, condition: 'Clear' } as any,
        { temperature: 35, humidity: 70, condition: 'Cloudy' } as any,
      ];

      const filtered = weatherService.filterByWeather(weatherData, { tempMin: 30 });
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].temperature).toBe(35);
    });
  });
});