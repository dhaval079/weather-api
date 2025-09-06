'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import axios from 'axios';

interface SearchFilters {
  searchText: string;
  tempMin: string;
  tempMax: string;
  humidityMin: string;
  humidityMax: string;
  weatherCondition: string;
  city: string;
  limit: number;
  offset: number;
}

const fetcher = (url: string) => axios.get(url).then(res => res.data);

const TEMP_MIN = -20;
const TEMP_MAX = 50;
const HUMIDITY_MIN = 0;
const HUMIDITY_MAX = 100;

export default function PropertySearch() {
  const [filters, setFilters] = useState<SearchFilters>({
    searchText: '',
    tempMin: TEMP_MIN.toString(),
    tempMax: TEMP_MAX.toString(),
    humidityMin: HUMIDITY_MIN.toString(),
    humidityMax: HUMIDITY_MAX.toString(),
    weatherCondition: '',
    city: '',
    limit: 20,
    offset: 0
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [debouncedFilters, setDebouncedFilters] = useState(filters);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters({...filters, offset: (currentPage - 1) * filters.limit});
    }, 300);
    return () => clearTimeout(timer);
  }, [filters, currentPage]);

  const queryString = new URLSearchParams(
    Object.entries(debouncedFilters)
      .filter(([key, value]) => {
        if (key === 'tempMin' && value === TEMP_MIN.toString()) return false;
        if (key === 'tempMax' && value === TEMP_MAX.toString()) return false;
        if (key === 'humidityMin' && value === HUMIDITY_MIN.toString()) return false;
        if (key === 'humidityMax' && value === HUMIDITY_MAX.toString()) return false;
        return value !== '' && value !== 0;
      })
      .map(([key, value]) => [key, String(value)])
  ).toString();

  const { data, error, isLoading } = useSWR(
    queryString ? `http://localhost:5002/get-properties?${queryString}` : 'http://localhost:5002/get-properties',
    fetcher,
    { 
      revalidateOnFocus: false,
      onError: (err) => {
        console.error('API Error:', err);
      }
    }
  );

  const handleFilterChange = (key: keyof SearchFilters, value: string | number) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const handleDualRangeChange = (type: 'temp' | 'humidity', values: [number, number]) => {
    if (type === 'temp') {
      setFilters(prev => ({ ...prev, tempMin: values[0].toString(), tempMax: values[1].toString() }));
    } else {
      setFilters(prev => ({ ...prev, humidityMin: values[0].toString(), humidityMax: values[1].toString() }));
    }
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setFilters({
      searchText: '',
      tempMin: TEMP_MIN.toString(),
      tempMax: TEMP_MAX.toString(),
      humidityMin: HUMIDITY_MIN.toString(),
      humidityMax: HUMIDITY_MAX.toString(),
      weatherCondition: '',
      city: '',
      limit: 20,
      offset: 0
    });
    setCurrentPage(1);
  };

  const totalPages = data ? Math.ceil(data.pagination?.total / filters.limit) : 0;

  // Simple dual range slider component
  const DualRangeSlider = ({ min, max, values, onChange, label, unit }: {
    min: number;
    max: number;
    values: [number, number];
    onChange: (values: [number, number]) => void;
    label: string;
    unit: string;
  }) => {
    const [minVal, maxVal] = values;
    
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">{label}</label>
          <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
            {minVal}{unit} - {maxVal}{unit}
          </span>
        </div>
        
        <div className="relative h-6">
          <input
            type="range"
            min={min}
            max={max}
            value={minVal}
            onChange={(e) => {
              const newMin = parseInt(e.target.value);
              onChange([Math.min(newMin, maxVal), maxVal]);
            }}
            className="absolute w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
          />
          <input
            type="range"
            min={min}
            max={max}
            value={maxVal}
            onChange={(e) => {
              const newMax = parseInt(e.target.value);
              onChange([minVal, Math.max(minVal, newMax)]);
            }}
            className="absolute w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
          />
        </div>
        
        <div className="flex justify-between text-xs text-gray-400">
          <span>{min}{unit}</span>
          <span>{max}{unit}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        
        {/* Simple Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Property Search</h1>
          <p className="text-gray-600">Find properties with weather-based filters</p>
        </div>

        {/* Clean Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="space-y-6">
            
            {/* Basic Search */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                <input
                  type="text"
                  placeholder="Property name..."
                  value={filters.searchText}
                  onChange={(e) => handleFilterChange('searchText', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                <input
                  type="text"
                  placeholder="City name..."
                  value={filters.city}
                  onChange={(e) => handleFilterChange('city', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Weather Condition */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Weather</label>
              <select
                value={filters.weatherCondition}
                onChange={(e) => handleFilterChange('weatherCondition', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All weather conditions</option>
                <option value="Clear">Clear</option>
                <option value="Cloudy">Cloudy</option>
                <option value="Drizzle">Drizzle</option>
                <option value="Rainy">Rainy</option>
                <option value="Snow">Snow</option>
              </select>
            </div>

            {/* Dual Range Sliders */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <DualRangeSlider
                min={TEMP_MIN}
                max={TEMP_MAX}
                values={[parseInt(filters.tempMin), parseInt(filters.tempMax)]}
                onChange={(values) => handleDualRangeChange('temp', values)}
                label="Temperature Range"
                unit="°C"
              />
              
              <DualRangeSlider
                min={HUMIDITY_MIN}
                max={HUMIDITY_MAX}
                values={[parseInt(filters.humidityMin), parseInt(filters.humidityMax)]}
                onChange={(values) => handleDualRangeChange('humidity', values)}
                label="Humidity Range"
                unit="%"
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={resetFilters}
                className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Reset Filters
              </button>
            </div>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 text-sm">
              {error?.response?.data?.error || 'Error loading properties'}
            </p>
          </div>
        )}

        {/* Results */}
        {data && (
          <>
            {/* Results Info */}
            <div className="flex justify-between items-center mb-6">
              <p className="text-sm text-gray-600">
                {data.pagination?.total || 0} properties found
              </p>
              {data.pagination?.total > 0 && (
                <p className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </p>
              )}
            </div>

            {/* Properties Grid */}
            {data.data && data.data.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {data.data.map((property: any) => (
                  <div
                    key={property.id}
                    className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
                  >
                    <h3 className="font-semibold text-lg text-gray-900 mb-2">
                      {property.name}
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                      📍 {property.city}, {property.state}
                    </p>
                    
                    {property.weather ? (
                      <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="text-2xl font-bold text-blue-900">
                              {property.weather.temperature}°C
                            </div>
                            <div className="text-sm text-blue-700">
                              {property.weather.condition}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-semibold text-blue-800">
                              {property.weather.humidity}%
                            </div>
                            <div className="text-xs text-blue-600">
                              Humidity
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 rounded-lg p-4 text-center">
                        <p className="text-sm text-gray-500">Weather data unavailable</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="text-4xl mb-4">🔍</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No properties found</h3>
                <p className="text-gray-600 mb-6">Try adjusting your search criteria</p>
                <button
                  onClick={resetFilters}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Reset Filters
                </button>
              </div>
            )}

            {/* Simple Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 bg-white"
                >
                  Previous
                </button>
                
                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                  let page;
                  if (totalPages <= 5) {
                    page = i + 1;
                  } else if (currentPage <= 3) {
                    page = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    page = totalPages - 4 + i;
                  } else {
                    page = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-2 text-sm border rounded-lg ${
                        currentPage === page
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-300 hover:bg-gray-50 bg-white'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
                
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 bg-white"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}