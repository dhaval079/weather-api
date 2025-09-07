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
      setDebouncedFilters({
        ...filters, 
        offset: (currentPage - 1) * filters.limit
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [filters, currentPage]);

  const queryString = new URLSearchParams(
    Object.entries(debouncedFilters)
      .filter(([key, value]) => {
        // Always include limit and offset for pagination
        if (key === 'limit' || key === 'offset') return true;
        
        // Filter out default values for other parameters
        if (key === 'tempMin' && value === TEMP_MIN.toString()) return false;
        if (key === 'tempMax' && value === TEMP_MAX.toString()) return false;
        if (key === 'humidityMin' && value === HUMIDITY_MIN.toString()) return false;
        if (key === 'humidityMax' && value === HUMIDITY_MAX.toString()) return false;
        
        return value !== '' && value !== '0' && value !== 0;
      })
      .map(([key, value]) => [key, String(value)])
  ).toString();

  const { data, error, isLoading } = useSWR(
    `${process.env.NEXT_PUBLIC_API_URL}/get-properties?${queryString}`,
    fetcher,
    { 
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      refreshInterval: 0,
      onError: (err) => {
        console.error('API Error:', err);
      }
    }
  );

  const handleFilterChange = (key: keyof SearchFilters, value: string | number) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to first page when filters change
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

  const totalPages = data?.pagination?.totalPages || 0;


  return (
    <div className="h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col">
      <div className="max-w-7xl mx-auto px-6 py-6 flex-1 flex flex-col">
        
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Property Search</h1>
          <p className="text-gray-600 text-sm">Find properties with weather filters</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4 mb-4 flex-shrink-0">
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4 items-end">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Search</label>
              <input
                type="text"
                placeholder="Property name"
                value={filters.searchText}
                onChange={(e) => handleFilterChange('searchText', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">City</label>
              <input
                type="text"
                placeholder="City"
                value={filters.city}
                onChange={(e) => handleFilterChange('city', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Weather</label>
              <select
                value={filters.weatherCondition}
                onChange={(e) => handleFilterChange('weatherCondition', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="">All</option>
                <option value="Clear">Clear</option>
                <option value="Cloudy">Cloudy</option>
                <option value="Rainy">Rainy</option>
                <option value="Snow">Snow</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Temp (°C)</label>
              <div className="flex space-x-1">
                <input
                  type="number"
                  min={TEMP_MIN}
                  max={parseInt(filters.tempMax) - 1}
                  value={filters.tempMin}
                  onChange={(e) => handleFilterChange('tempMin', e.target.value)}
                  className="w-full px-2 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                />
                <input
                  type="number"
                  min={parseInt(filters.tempMin) + 1}
                  max={TEMP_MAX}
                  value={filters.tempMax}
                  onChange={(e) => handleFilterChange('tempMax', e.target.value)}
                  className="w-full px-2 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Humidity (%)</label>
              <div className="flex space-x-1">
                <input
                  type="number"
                  min={HUMIDITY_MIN}
                  max={parseInt(filters.humidityMax) - 1}
                  value={filters.humidityMin}
                  onChange={(e) => handleFilterChange('humidityMin', e.target.value)}
                  className="w-full px-2 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                />
                <input
                  type="number"
                  min={parseInt(filters.humidityMin) + 1}
                  max={HUMIDITY_MAX}
                  value={filters.humidityMax}
                  onChange={(e) => handleFilterChange('humidityMax', e.target.value)}
                  className="w-full px-2 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              onClick={resetFilters}
              className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
            >
              Reset
            </button>
          </div>
        </div>

        {isLoading && (
          <div className="flex-1 overflow-y-auto mb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse">
                  <div className="mb-3">
                    <div className="h-4 bg-gray-300 rounded mb-1 w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                  <div className="bg-gray-50 rounded p-3 border">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="h-6 bg-gray-300 rounded w-12 mb-1"></div>
                        <div className="h-3 bg-gray-200 rounded w-16"></div>
                      </div>
                      <div className="text-right">
                        <div className="h-4 bg-gray-300 rounded w-8 mb-1"></div>
                        <div className="h-3 bg-gray-200 rounded w-12"></div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-1">
                    <div className="h-6 bg-gray-200 rounded w-12"></div>
                    <div className="h-6 bg-gray-200 rounded w-16"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Professional Error */}
        {error && (
          <div className="bg-red-50 border border-red-300 rounded-lg p-4 mb-6 flex-shrink-0 shadow-sm">
            <div className="flex items-center">
              <div className="text-red-500 mr-3">⚠️</div>
              <div>
                <h3 className="text-red-800 font-semibold text-sm mb-1">Error Loading Properties</h3>
                <p className="text-red-700 text-xs">
                  {error?.response?.data?.error || 'Unable to load properties. Please try again.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {data && (
          <>
            {/* Professional Results Info */}
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                <p className="text-sm font-medium text-gray-700">
                  {data.pagination?.total || 0} properties found
                </p>
              </div>
              {data.pagination?.total > 0 && (
                <div className="flex items-center space-x-3">
                  <p className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                    Page {data.pagination.currentPage} of {data.pagination.totalPages}
                  </p>
                  {data.pagination.totalPages > 1 && (
                    <p className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                      {data.pagination.limit} per page
                    </p>
                  )}
                </div>
              )}
            </div>

            {data.data && data.data.length > 0 ? (
              <div className="flex-1 overflow-y-auto mb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-4">
                  {data.data.map((property: { id: number; name: string; city: string; state: string; weather?: { temperature: number; condition: string; humidity: number }; tags?: string[] }) => (
                    <div
                      key={property.id}
                      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="mb-3">
                        <h3 className="font-semibold text-sm text-gray-900 mb-1 truncate">
                          {property.name}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {property.city}, {property.state}
                        </p>
                      </div>
                      
                      {property.weather ? (
                        <div className="bg-gray-50 rounded p-3 border">
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="text-lg font-bold text-gray-900">
                                {property.weather.temperature}°C
                              </div>
                              <div className="text-xs text-gray-600">
                                {property.weather.condition}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-semibold text-gray-700">
                                {property.weather.humidity}%
                              </div>
                              <div className="text-xs text-gray-500">
                                Humidity
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-50 rounded p-3 text-center">
                          <p className="text-xs text-gray-500">Weather unavailable</p>
                        </div>
                      )}
                      
                      {property.tags && property.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {property.tags.slice(0, 2).map((tag: string) => (
                            <span 
                              key={tag}
                              className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded font-medium"
                            >
                              {tag}
                            </span>
                          ))}
                          {property.tags.length > 2 && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                              +{property.tags.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center p-8">
                  <div className="text-5xl mb-4">🔍</div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">No properties found</h3>
                  <p className="text-gray-600 mb-6 max-w-md">We couldn&apos;t find any properties matching your current search criteria. Try adjusting your filters to see more results.</p>
                  <button
                    onClick={resetFilters}
                    className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl font-medium"
                  >
                    Reset All Filters
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Advanced Pagination */}
        {data && data.pagination && data.pagination.totalPages > 1 && (
          <div className="border-t bg-white p-4 flex-shrink-0 shadow-sm">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-1">
                {/* First page */}
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                  title="First page"
                >
                  ««
                </button>
                
                {/* Previous page */}
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                  title="Previous page"
                >
                  ‹
                </button>
                
                {/* Page numbers */}
                <div className="flex space-x-1">
                  {(() => {
                    const pages = [];
                    const start = Math.max(1, currentPage - 2);
                    const end = Math.min(totalPages, currentPage + 2);
                    
                    // Show ellipsis before if needed
                    if (start > 1) {
                      pages.push(
                        <button
                          key={1}
                          onClick={() => setCurrentPage(1)}
                          className="px-3 py-1 text-sm border rounded hover:bg-gray-50 transition-colors"
                        >
                          1
                        </button>
                      );
                      if (start > 2) {
                        pages.push(
                          <span key="ellipsis-start" className="px-2 text-sm text-gray-500">
                            ...
                          </span>
                        );
                      }
                    }
                    
                    // Show page numbers around current page
                    for (let i = start; i <= end; i++) {
                      pages.push(
                        <button
                          key={i}
                          onClick={() => setCurrentPage(i)}
                          className={`px-3 py-1 text-sm border rounded transition-colors ${
                            currentPage === i
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          {i}
                        </button>
                      );
                    }
                    
                    // Show ellipsis after if needed
                    if (end < totalPages) {
                      if (end < totalPages - 1) {
                        pages.push(
                          <span key="ellipsis-end" className="px-2 text-sm text-gray-500">
                            ...
                          </span>
                        );
                      }
                      pages.push(
                        <button
                          key={totalPages}
                          onClick={() => setCurrentPage(totalPages)}
                          className="px-3 py-1 text-sm border rounded hover:bg-gray-50 transition-colors"
                        >
                          {totalPages}
                        </button>
                      );
                    }
                    
                    return pages;
                  })()}
                </div>
                
                {/* Next page */}
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                  title="Next page"
                >
                  ›
                </button>
                
                {/* Last page */}
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                  title="Last page"
                >
                  »»
                </button>
              </div>
              
              {/* Page info and quick jump */}
              <div className="flex items-center space-x-3">
                <div className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex items-center space-x-1">
                  <span className="text-xs text-gray-500">Go to:</span>
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={currentPage}
                    onChange={(e) => {
                      const page = parseInt(e.target.value);
                      if (page >= 1 && page <= totalPages) {
                        setCurrentPage(page);
                      }
                    }}
                    className="w-16 px-2 py-1 text-xs border rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}