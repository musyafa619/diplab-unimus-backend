import { Router } from 'express';
import {
  createBooking,
  listBookings,
  getBookingById,
  updateBooking,
  deleteBooking,
} from '../../controllers/bookingController';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.post('/', createBooking);
router.get('/', listBookings);
router.get('/:id', getBookingById);
router.put('/:id', updateBooking);
router.delete('/:id', deleteBooking);

export default router;
