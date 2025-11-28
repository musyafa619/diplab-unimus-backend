import { Router } from 'express';
import { healthCheck } from '../controllers/healthController';
import adminsRouter from './admins';
import itemsRouter from './items';

const router = Router();

router.get('/health', healthCheck);

router.use('/admins', adminsRouter);
router.use('/items', itemsRouter);

// Dev-only debug endpoint to inspect incoming cookies and headers
if (process.env.NODE_ENV !== 'production') {
  router.get('/debug/cookies', (req, res) => {
    return res.json({
      headersCookie: req.headers.cookie || null,
      parsedCookies: req.cookies || null,
    });
  });
}

export default router;
