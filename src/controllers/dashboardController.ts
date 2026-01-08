import { Request, Response } from 'express';
import Booking from '../models/booking';
import Item from '../models/item';
import Student from '../models/student';
import Major from '../models/major';

export const getDashboardSummary = async (req: Request, res: Response) => {
  try {
    // Get counts of all resources
    const [totalItems, totalBookings, totalStudents, totalMajors] =
      await Promise.all([
        Item.countDocuments().exec(),
        Booking.countDocuments().exec(),
        Student.countDocuments().exec(),
        Major.countDocuments().exec(),
      ]);

    // Get last 5 pending bookings
    const pendingBookings = await Booking.find({ status: 'pending' })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('studentId', 'name email')
      .lean();

    // Transform pending bookings to match getListBookings format
    const formattedPendingBookings = pendingBookings.map((b: any) => {
      const { __v, _id, studentId, ...rest } = b;
      return {
        ...rest,
        student: studentId
          ? {
              id: studentId._id.toString(),
              name: studentId.name,
              email: studentId.email,
            }
          : null,
        id: _id.toString(),
      };
    });

    return res.json({
      data: {
        counts: {
          totalItems,
          totalBookings,
          totalStudents,
          totalMajors,
        },
        lastPendingBookings: formattedPendingBookings,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
