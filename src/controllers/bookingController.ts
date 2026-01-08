import { Request, Response } from 'express';
import { Types } from 'mongoose';
import Booking, { IBooking } from '../models/booking';
import Student from '../models/student';
import Item from '../models/item';

export async function createBooking(req: Request, res: Response) {
  try {
    const { studentId, items, startDate, endDate } = req.body;
    if (!studentId || !startDate || !endDate)
      return res
        .status(400)
        .json({ error: 'studentId, startDate and endDate are required' });

    // validate student
    const student = await Student.findById(studentId).lean();
    if (!student) return res.status(400).json({ error: 'invalid studentId' });

    // validate items if provided
    // items is now an array of objects with { id, quantity }
    let validatedItems: any[] = [];
    if (items && Array.isArray(items) && items.length > 0) {
      // extract item ids from the objects
      const itemIds = items.map((item: any) => item.id);
      const count = await Item.countDocuments({ _id: { $in: itemIds } }).exec();
      if (count !== itemIds.length)
        return res.status(400).json({ error: 'one or more invalid item ids' });
      validatedItems = items;
    }

    await Booking.create({
      studentId,
      items: validatedItems,
      startDate,
      endDate,
    });

    return res.status(201).json({
      success: true,
      message: 'Booking created successfully',
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function getListBookings(req: Request, res: Response) {
  try {
    // optional search param to filter by id (case-insensitive, partial)
    const search =
      typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (search) {
      // search by booking _id (only if it's a valid ObjectId format)
      if (Types.ObjectId.isValid(search)) {
        filter._id = search;
      } else {
        // if search is provided but not a valid ObjectId, return empty results
        return res.json({
          data: [],
          meta: { total: 0, page, limit, totalPages: 0 },
        });
      }
    }

    // optional status filter
    const validStatuses = ['pending', 'approved', 'rejected', 'finished'];
    const rawStatus =
      typeof req.query.status === 'string'
        ? req.query.status.trim().toLowerCase()
        : '';
    if (rawStatus && validStatuses.includes(rawStatus)) {
      filter.status = rawStatus;
    }

    // Sorting
    // supported sort fields to avoid arbitrary field injection
    const allowedSortFields = ['createdAt'];
    const rawSortBy =
      typeof req.query.sortBy === 'string' ? req.query.sortBy.trim() : '';
    const sortBy = allowedSortFields.includes(rawSortBy)
      ? rawSortBy
      : 'updatedAt';
    const rawOrder =
      typeof req.query.orderBy === 'string'
        ? req.query.orderBy.trim().toLowerCase()
        : 'asc';
    const order = rawOrder === 'desc' ? -1 : 1;

    const [total, bookings] = await Promise.all([
      Booking.countDocuments(filter).exec(),
      Booking.find(filter)
        .sort({ [sortBy]: order })
        .skip(skip)
        .limit(limit)
        .populate('studentId', 'name email')
        .lean(),
    ]);

    const out = bookings.map((b) => {
      const { __v, _id, studentId, ...rest } = b as any;
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
      data: out,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function getBookingById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const booking = await Booking.findById(id)
      .populate({
        path: 'studentId',
        select: 'name nim email phoneNumber',
        populate: {
          path: 'majorId',
          select: 'name',
        },
      })
      .populate('items.id', 'name description imageUrl')
      .lean();
    if (!booking) return res.status(404).json({ error: 'not found' });
    const { __v, _id, studentId, items, ...rest } = booking as any;

    console.log(items);
    return res.json({
      ...rest,
      id: _id.toString(),
      student: studentId
        ? {
            id: studentId._id.toString(),
            name: studentId.name,
            nim: studentId.nim,
            email: studentId.email,
            phoneNumber: studentId.phoneNumber,
            major: studentId.majorId
              ? {
                  id: studentId.majorId._id.toString(),
                  name: studentId.majorId.name,
                }
              : null,
          }
        : null,
      items: Array.isArray(items)
        ? items.map((item: any) => ({
            id: item.id._id.toString(),
            name: item.id.name,
            description: item.id.description,
            quantity: item.quantity,
            imageUrl: item.id.imageUrl,
          }))
        : [],
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function approveBooking(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { items } = req.body;

    // Validate request items structure
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'items must be an array' });
    }

    if (items.length === 0) {
      return res.status(400).json({ error: 'items array cannot be empty' });
    }

    // Fetch existing booking
    const booking: IBooking | null = await Booking.findById(id).lean();
    if (!booking) return res.status(404).json({ error: 'booking not found' });

    // Extract item IDs from request
    const itemIds = items.map((item: any) => item.id);

    // Verify all item IDs exist in Item collection
    const count = await Item.countDocuments({ _id: { $in: itemIds } }).exec();
    if (count !== itemIds.length) {
      return res.status(400).json({ error: 'one or more invalid item ids' });
    }

    // Build a map of booking items for easy lookup
    const bookingItemsMap = new Map();
    booking.items.forEach((bookingItem: any) => {
      const itemId = bookingItem.id?.toString() || bookingItem.id;
      bookingItemsMap.set(itemId, bookingItem.quantity);
    });

    // Validate request quantities don't exceed booking quantities
    for (const requestItem of items) {
      const itemId = requestItem.id;
      const bookingQuantity = bookingItemsMap.get(itemId);

      if (typeof requestItem.quantity !== 'number') {
        return res.status(400).json({
          error: `Item ${itemId} quantity is not in valid`,
        });
      }

      if (requestItem.quantity > bookingQuantity) {
        return res.status(400).json({
          error: `Item ${itemId} requested quantity (${requestItem.quantity}) exceeds booking quantity (${bookingQuantity})`,
        });
      }
    }

    const isEmptyQuantity = items.every((item: any) => item.quantity === 0);

    if (isEmptyQuantity) {
      return res.status(400).json({
        error: 'at least one item must have quantity greater than zero',
      });
    }

    // All validations passed, update booking status to 'approved'
    const updated = await Booking.findByIdAndUpdate(
      id,
      { $set: { status: 'approved', items } },
      { new: true }
    ).lean();

    if (!updated) return res.status(404).json({ error: 'not found' });

    return res.status(200).json({
      success: true,
      message: 'Booking approved successfully',
      data: updated,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function updateBookingStatus(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const update: any = {};
    if (status !== undefined) {
      const validStatuses = ['rejected', 'finished'];
      if (!validStatuses.includes(status))
        return res.status(400).json({ error: 'invalid status value' });
      update.status = status;
    }

    const updated = await Booking.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true }
    ).lean();
    if (!updated) return res.status(404).json({ error: 'not found' });
    return res.status(200).json({
      success: true,
      message: 'Booking status updated successfully',
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function deleteBooking(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const removed = await Booking.findByIdAndDelete(id).lean();
    if (!removed) return res.status(404).json({ error: 'not found' });
    const { __v, ...rest } = removed as any;
    return res.json(rest);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
