import { Router } from 'express';
import {
  createBooking,
  getListBookings,
  getBookingById,
  approveBooking,
  deleteBooking,
  updateBookingStatus,
} from '../../controllers/bookingController';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.post('/', createBooking);
router.get('/', getListBookings);
router.get('/:id', getBookingById);
router.put('/:id/approve', approveBooking);
router.put('/:id/update-status', updateBookingStatus);
router.delete('/:id', deleteBooking);

export default router;
