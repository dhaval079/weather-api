import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.1'],
  },
};

const BASE_URL = 'http://localhost:5001';

export default function () {
  // Test property search
  const searchResponse = http.get(`${BASE_URL}/get-properties?limit=10`);
  check(searchResponse, {
    'search status is 200': (r) => r.status === 200,
    'search response time < 500ms': (r) => r.timings.duration < 500,
  });

  // Test with weather filters
  const weatherResponse = http.get(`${BASE_URL}/get-properties?tempMin=20&tempMax=35`);
  check(weatherResponse, {
    'weather filter status is 200': (r) => r.status === 200,
  });

  // Test suggestions
  const suggestResponse = http.get(`${BASE_URL}/suggestions?q=war`);
  check(suggestResponse, {
    'suggestions status is 200': (r) => r.status === 200,
  });

  sleep(1);
}