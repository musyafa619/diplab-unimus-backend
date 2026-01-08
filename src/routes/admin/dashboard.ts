import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { getDashboardSummary } from '../../controllers/dashboardController';

const router = Router();

router.use(authMiddleware);

router.get('/summary', getDashboardSummary);

export default router;
