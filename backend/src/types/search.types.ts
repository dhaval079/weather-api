export interface SearchResult {
  properties: any[];
  total: number;
  searchTime: number;
  hasMore: boolean;
}

export interface WeatherData {
  temperature: number;
  humidity: number;
  condition: string;
  weatherCode: number;
  lastUpdated?: Date;
}

export interface PropertySearchParams {
  searchText?: string;
  city?: string;
  state?: string;
  tempMin?: number;
  tempMax?: number;
  humidityMin?: number;
  humidityMax?: number;
  weatherCondition?: string;
  tags?: string[];
  lat?: number;
  lng?: number;
  radiusKm?: number;
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'city' | 'distance' | '_score';
  sortOrder?: 'asc' | 'desc';
}

export interface PerformanceMetrics {
  searchTime: number;
  totalResults: number;
  cacheHit: boolean;
  source: 'elasticsearch' | 'database' | 'cache';
}