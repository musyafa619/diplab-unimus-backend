import { Router } from 'express';
import { healthCheck } from '../controllers/healthController';
import adminsRouter from './admin/admins';
import dashboardRouter from './admin/dashboard';
import itemsRouter from './admin/items';
import majorsRouter from './admin/majors';
import studentsRouter from './admin/students';
import bookingsRouter from './admin/bookings';
import clientRouter from './client/clients';

const router = Router();

router.get('/health', healthCheck);

// Client routes
router.use('/', clientRouter);

// Mount all management routes under /admin so final paths are /api/admin/...
router.use('/admin', adminsRouter);
router.use('/admin/dashboard', dashboardRouter);
router.use('/admin/items', itemsRouter);
router.use('/admin/majors', majorsRouter);
router.use('/admin/students', studentsRouter);
router.use('/admin/bookings', bookingsRouter);

export default router;
