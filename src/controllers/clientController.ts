import { Request, Response } from 'express';
import { Types } from 'mongoose';
import Item from '../models/item';
import Booking from '../models/booking';
import Student from '../models/student';
import { resend } from '../config/resend';

export async function getAvailableItems(req: Request, res: Response) {
  try {
    const { startDate, endDate, search } = req.query;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    // Validate required query params
    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ message: 'startDate and endDate query params are required' });
    }

    // Parse and validate dates
    const start = new Date(String(startDate));
    const end = new Date(String(endDate));

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }

    if (start > end) {
      return res
        .status(400)
        .json({ message: 'startDate must be before or equal to endDate' });
    }

    // Build filter for items (search by name if provided)
    const filter: any = {};
    if (search) {
      filter.name = { $regex: String(search).trim(), $options: 'i' };
    }

    // Get items with pagination
    const [total, items] = await Promise.all([
      Item.countDocuments(filter).exec(),
      Item.find(filter).skip(skip).limit(limit).lean(),
    ]);

    // Find bookings that overlap with the date range and have status pending or approved
    const bookings = await Booking.find({
      status: { $in: ['pending', 'approved'] },
      $or: [
        {
          startDate: { $lte: end },
          endDate: { $gte: start },
        },
      ],
    })
      .select('items')
      .lean();

    // Build a map of item ID -> total booked quantity during the date range
    const bookedQuantityMap = new Map<string, number>();

    bookings.forEach((booking: any) => {
      if (Array.isArray(booking.items)) {
        booking.items.forEach((item: any) => {
          const itemId = item.id.toString();
          const currentBooked = bookedQuantityMap.get(itemId) || 0;
          bookedQuantityMap.set(itemId, currentBooked + item.quantity);
        });
      }
    });

    // Transform items to include available quantity
    const availableItems = items.map((item: any) => {
      const bookedQty = bookedQuantityMap.get(item._id.toString()) || 0;
      const availableStock = Math.max(0, item.stock - bookedQty);

      const { __v, _id, stock, ...rest } = item;
      return {
        ...rest,
        id: _id.toString(),
        stock: availableStock,
      };
    });

    return res.json({
      data: availableItems,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}

export async function getStudentByNim(req: Request, res: Response) {
  try {
    const { nim } = req.params;

    if (!nim) {
      return res.status(400).json({ message: 'nim is required' });
    }

    const student = await Student.findOne({ nim })
      .populate({
        path: 'majorId',
        select: 'name',
      })
      .lean();

    if (!student) {
      return res.status(404).json({ message: 'student not found' });
    }

    const { __v, _id, majorId, ...rest } = student as any;

    return res.json({
      data: {
        ...rest,
        id: _id.toString(),
        major: majorId
          ? {
              id: majorId._id.toString(),
              name: majorId.name,
            }
          : null,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}

export async function createBooking(req: Request, res: Response) {
  try {
    const { studentId, startDate, endDate, items, note } = req.body;

    // Validate required fields
    if (!studentId || !startDate || !endDate || !items) {
      return res.status(400).json({
        message: 'studentId, startDate, endDate, and items are required',
      });
    }

    // Validate studentId
    if (!Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ message: 'invalid studentId format' });
    }

    const student = await Student.findById(studentId).lean();
    if (!student) {
      return res.status(400).json({ message: 'student not found' });
    }

    // Parse and validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }

    // Validate startDate and endDate are today or in the future
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (start < today) {
      return res
        .status(400)
        .json({ message: 'startDate must be today or in the future' });
    }

    if (end < today) {
      return res
        .status(400)
        .json({ message: 'endDate must be today or in the future' });
    }

    if (start > end) {
      return res
        .status(400)
        .json({ message: 'startDate must be before or equal to endDate' });
    }

    // Validate items array
    if (!Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ message: 'items must be a non-empty array' });
    }

    // Validate each item has id and quantity
    for (const item of items) {
      if (!item.id || typeof item.quantity !== 'number') {
        return res.status(400).json({
          message: 'each item must have id (string) and quantity (number)',
        });
      }

      if (!Types.ObjectId.isValid(item.id)) {
        return res.status(400).json({ message: `invalid item id: ${item.id}` });
      }

      if (item.quantity <= 0) {
        return res.status(400).json({
          message: `item quantity must be greater than 0`,
        });
      }
    }

    // Verify all item IDs exist
    const itemIds = items.map((item: any) => item.id);
    const existingItems = await Item.find({ _id: { $in: itemIds } }).lean();

    if (existingItems.length !== itemIds.length) {
      return res.status(400).json({ message: 'one or more invalid item ids' });
    }

    // Create a map of item IDs to their stock
    const itemStockMap = new Map<string, number>();
    existingItems.forEach((item: any) => {
      itemStockMap.set(item._id.toString(), item.stock);
    });

    // Find overlapping bookings with pending or approved status
    const overlappingBookings = await Booking.find({
      status: { $in: ['pending', 'approved'] },
      $or: [
        {
          startDate: { $lte: end },
          endDate: { $gte: start },
        },
      ],
    })
      .select('items')
      .lean();

    // Build a map of item ID -> total booked quantity during the date range
    const bookedQuantityMap = new Map<string, number>();

    overlappingBookings.forEach((booking: any) => {
      if (Array.isArray(booking.items)) {
        booking.items.forEach((item: any) => {
          const itemId = item.id.toString();
          const currentBooked = bookedQuantityMap.get(itemId) || 0;
          bookedQuantityMap.set(itemId, currentBooked + item.quantity);
        });
      }
    });

    // Validate stock availability for each item in the booking
    for (const requestItem of items) {
      const itemId = requestItem.id;
      const totalStock = itemStockMap.get(itemId) || 0;
      const bookedQty = bookedQuantityMap.get(itemId) || 0;
      const availableStock = totalStock - bookedQty;

      if (requestItem.quantity > availableStock) {
        const itemData = existingItems.find(
          (i: any) => i._id.toString() === itemId,
        );
        return res.status(400).json({
          message: `insufficient stock for ${
            itemData?.name || itemId
          }. available: ${availableStock}, requested: ${requestItem.quantity}`,
        });
      }
    }

    // All validations passed, create booking
    await Booking.create({
      studentId,
      items,
      startDate: start,
      endDate: end,
      note: note || '',
      status: 'pending',
    });

    return res.status(201).json({
      message: 'Booking created successfully',
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
