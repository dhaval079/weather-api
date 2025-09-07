import request from 'supertest';
import app from '../src/index';

describe('Performance Tests', () => {
  test('Properties search should respond within 500ms', async () => {
    const start = Date.now();
    
    const response = await request(app)
      .get('/get-properties')
      .query({
        tempMin: 20,
        tempMax: 35,
        humidityMin: 40,
        humidityMax: 80,
        limit: 20
      });
    
    const duration = Date.now() - start;
    
    expect(response.status).toBe(200);
    expect(duration).toBeLessThan(500);
    expect(response.body.success).toBe(true);
  });

  test('Cached requests should be faster', async () => {
    const query = {
      tempMin: 25,
      tempMax: 30,
      weatherCondition: 'Clear'
    };

    // First request (cache miss)
    const start1 = Date.now();
    await request(app).get('/get-properties').query(query);
    const duration1 = Date.now() - start1;

    // Second request (cache hit)
    const start2 = Date.now();
    await request(app).get('/get-properties').query(query);
    const duration2 = Date.now() - start2;

    expect(duration2).toBeLessThan(duration1 * 0.5); // Should be at least 50% faster
  });
});