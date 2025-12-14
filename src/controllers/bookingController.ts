import { Request, Response } from 'express';
import Booking from '../models/booking';
import Student from '../models/student';
import Item from '../models/item';

export async function createBooking(req: Request, res: Response) {
  try {
    const { studentId, items, start_date, end_date } = req.body;
    if (!studentId || !start_date || !end_date)
      return res
        .status(400)
        .json({ error: 'studentId, start_date and end_date are required' });

    // validate student
    const student = await Student.findById(studentId).lean();
    if (!student) return res.status(400).json({ error: 'invalid studentId' });

    // validate items if provided
    if (items && Array.isArray(items) && items.length > 0) {
      const count = await Item.countDocuments({ _id: { $in: items } }).exec();
      if (count !== items.length)
        return res.status(400).json({ error: 'one or more invalid item ids' });
    }

    const booking = await Booking.create({
      studentId,
      items: items || [],
      start_date,
      end_date,
    });
    const out = booking.toObject();
    delete (out as any).__v;
    return res.status(201).json(out);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function listBookings(req: Request, res: Response) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const [total, bookings] = await Promise.all([
      Booking.countDocuments({}).exec(),
      Booking.find().sort({ createdAt: 1 }).skip(skip).limit(limit).lean(),
    ]);

    const out = bookings.map((b) => {
      const { __v, ...rest } = b as any;
      return rest;
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
    const booking = await Booking.findById(id).lean();
    if (!booking) return res.status(404).json({ error: 'not found' });
    const { __v, ...rest } = booking as any;
    return res.json(rest);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function updateBooking(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { studentId, items, start_date, end_date } = req.body;

    const update: any = {};
    if (studentId !== undefined) {
      const student = await Student.findById(studentId).lean();
      if (!student) return res.status(400).json({ error: 'invalid studentId' });
      update.studentId = studentId;
    }

    if (items !== undefined) {
      if (!Array.isArray(items))
        return res.status(400).json({ error: 'items must be an array' });
      const count = await Item.countDocuments({ _id: { $in: items } }).exec();
      if (count !== items.length)
        return res.status(400).json({ error: 'one or more invalid item ids' });
      update.items = items;
    }

    if (start_date !== undefined) update.start_date = start_date;
    if (end_date !== undefined) update.end_date = end_date;

    const updated = await Booking.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true }
    ).lean();
    if (!updated) return res.status(404).json({ error: 'not found' });
    const { __v, ...rest } = updated as any;
    return res.json(rest);
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
