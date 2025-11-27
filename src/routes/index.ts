import { Router } from 'express';
import { healthCheck } from '../controllers/healthController';
import adminsRouter from './admins';
import itemsRouter from './items';

const router = Router();

router.get('/health', healthCheck);

router.use('/admins', adminsRouter);
router.use('/items', itemsRouter);

export default router;
