// Load environment variables before importing any modules that depend on them
import 'dotenv/config';
import express, { Request, Response } from 'express';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { connectDB } from './config/db';
import cookieParser from 'cookie-parser';

// Simple CORS middleware to allow requests from the React dev server
// Use FRONTEND_ORIGIN env var to allow a custom origin (defaults to http://localhost:3039)
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3039';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Enable CORS for the frontend dev origin and allow credentials (cookies)
app.use((req, res, next) => {
  const origin = req.headers.origin as string | undefined;
  if (origin && origin === FRONTEND_ORIGIN) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, Authorization'
    );
  }

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  return next();
});

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
