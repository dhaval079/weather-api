import { Request, Response } from "express";
import { PropertyService, SearchFilters } from "../services/property.service";

const propertyService = new PropertyService();

export const getProperties = async (req: Request, res: Response) => {
  try {
    const filters: SearchFilters = {
      searchText: req.query.searchText as string,
      city: req.query.city as string,
      state: req.query.state as string,
      tempMin: req.query.tempMin ? parseFloat(req.query.tempMin as string) : undefined,
      tempMax: req.query.tempMax ? parseFloat(req.query.tempMax as string) : undefined,
      humidityMin: req.query.humidityMin ? parseFloat(req.query.humidityMin as string) : undefined,
      humidityMax: req.query.humidityMax ? parseFloat(req.query.humidityMax as string) : undefined,
      weatherCondition: req.query.weatherCondition as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      tags: req.query.tags ? (req.query.tags as string).split(',') : undefined
    };

    // Validate filters
    if (filters.tempMin !== undefined && (filters.tempMin < -20 || filters.tempMin > 50)) {
      return res.status(400).json({ error: "Temperature min must be between -20°C and 50°C" });
    }
    
    if (filters.tempMax !== undefined && (filters.tempMax < -20 || filters.tempMax > 50)) {
      return res.status(400).json({ error: "Temperature max must be between -20°C and 50°C" });
    }

    if (filters.humidityMin !== undefined && (filters.humidityMin < 0 || filters.humidityMin > 100)) {
      return res.status(400).json({ error: "Humidity min must be between 0% and 100%" });
    }

    if (filters.humidityMax !== undefined && (filters.humidityMax < 0 || filters.humidityMax > 100)) {
      return res.status(400).json({ error: "Humidity max must be between 0% and 100%" });
    }

    const validWeatherConditions = ['Clear', 'Cloudy', 'Drizzle', 'Rainy', 'Snow'];
    if (filters.weatherCondition && !validWeatherConditions.includes(filters.weatherCondition)) {
      return res.status(400).json({ 
        error: "Invalid weather condition",
        validConditions: validWeatherConditions 
      });
    }

    const result = await propertyService.searchProperties(filters);

    return res.json({
      success: true,
      data: result.properties,
      pagination: {
        total: result.total,
        limit: filters.limit || 20,
        offset: filters.offset || 0,
        hasMore: result.hasMore
      },
      filters: {
        applied: filters,
        available: {
          weatherConditions: validWeatherConditions,
          temperatureRange: { min: -20, max: 50 },
          humidityRange: { min: 0, max: 100 }
        }
      }
    });
  } catch (error) {
    console.error("Error fetching properties:", error);
    return res.status(500).json({ 
      success: false, 
      error: "Internal Server Error",
      message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Something went wrong'
    });
  }
};