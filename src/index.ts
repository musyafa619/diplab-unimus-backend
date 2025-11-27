import express, { Request, Response } from 'express';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { connectDB } from './config/db';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';

dotenv.config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/api', routes);

app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Welcome to diblab-unimus-backend API' });
});

// Error handler (should be last)
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 3000;

async function start() {
  if (process.env.NODE_ENV !== 'test') {
    try {
      await connectDB();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to connect to database', err);
      process.exit(1);
    }

    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`Server running on port ${PORT}`);
    });
  }
}

start();

export default app;
