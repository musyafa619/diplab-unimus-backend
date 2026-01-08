import { Router } from 'express';
import {
  getAvailableItems,
  getStudentByNim,
  createBooking,
} from '../../controllers/clientController';

const router = Router();

router.get('/available-items', getAvailableItems);
router.get('/student/:nim', getStudentByNim);
router.post('/bookings', createBooking);

export default router;
