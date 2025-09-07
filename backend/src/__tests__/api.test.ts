import request from 'supertest';
import app from '../index';

describe('API Integration Tests', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
    });
  });

  describe('GET /get-properties', () => {
    it('should return properties without filters', async () => {
      const response = await request(app).get('/get-properties');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should filter by city', async () => {
      const response = await request(app)
        .get('/get-properties')
        .query({ city: 'Chennai' });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should handle weather filters', async () => {
      const response = await request(app)
        .get('/get-properties')
        .query({ tempMin: 20, tempMax: 35 });
      
      expect(response.status).toBe(200);
      expect(response.body.metrics).toBeDefined();
    });
  });

  describe('GET /suggestions', () => {
    it('should return suggestions', async () => {
      const response = await request(app)
        .get('/suggestions')
        .query({ q: 'war' });
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should handle empty query', async () => {
      const response = await request(app).get('/suggestions');
      
      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
    });
  });

  describe('GET /metrics', () => {
    it('should return performance metrics', async () => {
      const response = await request(app).get('/metrics');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.performance).toBeDefined();
    });
  });
});