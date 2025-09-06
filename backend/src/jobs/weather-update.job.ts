import Queue from 'bull';
import { prisma } from '../database/prisma';
import { WeatherService } from '../services/weather.service';
import cron from 'node-cron';

const weatherQueue = new Queue('weather updates', process.env.REDIS_URL || 'redis://localhost:6379');
const weatherService = new WeatherService();

// Job processor
weatherQueue.process('updateWeatherBatch', 5, async (job) => {
  const { coordinates } = job.data;
  
  try {
    await weatherService.getWeatherBatch(coordinates);
    console.log(`Updated weather for ${coordinates.length} locations`);
  } catch (error) {
    console.error('Weather update job failed:', error);
    throw error;
  }
});

// Schedule weather updates every 30 minutes
export const scheduleWeatherUpdates = () => {
  cron.schedule('*/30 * * * *', async () => {
    try {
      console.log('Starting scheduled weather updates...');
      
      // Get all active properties with coordinates
      const properties = await prisma.property.findMany({
        where: {
          isActive: true,
          lat: { not: null },
          lng: { not: null }
        },
        select: { id: true, lat: true, lng: true }
      });

      // Group into batches of 100
      const batchSize = 100;
      const batches = [];
      
      for (let i = 0; i < properties.length; i += batchSize) {
        const batch = properties.slice(i, i + batchSize);
        batches.push(batch.map(p => ({ lat: p.lat!, lng: p.lng!, id: p.id })));
      }

      // Queue each batch
      for (const coordinates of batches) {
        await weatherQueue.add('updateWeatherBatch', { coordinates }, {
          delay: Math.random() * 5000, // Spread requests over 5 seconds
          attempts: 3,
          backoff: { type: 'exponential' }
        });
      }

      console.log(`Queued ${batches.length} weather update batches`);
    } catch (error) {
      console.error('Error scheduling weather updates:', error);
    }
  });
};

// Monitor queue health
weatherQueue.on('completed', (job) => {
  console.log(`Weather job ${job.id} completed`);
});

weatherQueue.on('failed', (job, err) => {
  console.error(`Weather job ${job.id} failed:`, err);
});

export { weatherQueue };