import { Request, Response } from 'express';
import { Types } from 'mongoose';
import Booking, { IBooking } from '../models/booking';
import Student from '../models/student';
import Item from '../models/item';
import { resend } from '../config/resend';
import dayjs from 'dayjs';

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
      { new: true },
    ).lean();

    if (!updated) return res.status(404).json({ error: 'not found' });

    const updatedId = (updated as any)._id;
    const populated = await Booking.findById(updatedId)
      .populate('studentId', 'name email')
      .populate('items.id', 'name')
      .lean();

    const studentInfo = ((populated as any)?.studentId || {}) as any;

    const stringifiedItems = ((populated as any)?.items || [])
      .map((item: any) => item.id.name + ' x' + item.quantity)
      .join(', ');

    resend.emails.send({
      from: 'diplab@nopidekha.dev',
      to: 'delishaunimus@gmail.com',
      subject: 'Diplab - Booking Disetujui',
      html: `
      <!doctype html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <title>Notifikasi Penyewaan</title>
    <style>
      /* BODY */
      body.notif-body {
        background-color: #f7f8fa;
        padding: 60px 0;
        font-family: 'Poppins', sans-serif;
      }

      /* CONTAINER */
      .email-container {
        max-width: 900px;
        margin: 90px auto;
        background: #ffffff;
        border-radius: 10px;
        border: 1px solid #0067e5;
        padding: 30px 70px 30px 70px;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
      }

      /* LOGO */
      .logo img {
        max-width: 140px;
        margin-bottom: 20px;
      }

      /* HEADER */
      .greeting {
        text-align: center;
        color: #444;
      }

      .title-danger {
        text-align: center;
        color: #2d88ffff;
        margin-bottom: 30px;
        font-size: 20px;
      }

      /* DETAILS */
      .details {
        background: #edeffe;
        border-radius: 15px;
        padding: 20px 20px 20px 20px;
        margin-bottom: 20px;
        text-align: left;
      }

      .detail-title {
        padding-right: 200px !important;
      }

      .details h3 {
        margin-bottom: 25px;
      }

      .detail-items {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .detail-row {
        display: grid;
        grid-template-columns: 250px 1fr;
        font-size: 14px;
      }

      /* INFO BOX */
      .info-box {
        display: flex;
        gap: 15px;
        background: #eef1ff;
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 30px;
      }

      .info-icon {
        width: 95px;
        height: 36px;
        background: #ffcc00;
        color: #fff;
        font-weight: bold;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .info-content p {
        margin: 9px 0;
        font-size: 15px;
      }

      .contact {
        font-weight: bold;
      }

      /* BUTTON */
      .btn-primary {
        display: block;
        text-align: center;
        background: #1e66ff;
        color: #fff;
        padding: 12px;
        border-radius: 8px;
        text-decoration: none;
        font-weight: 600;
      }
    </style>
  </head>

  <body class="notif-body">
    <div class="email-container">
      <!-- LOGO -->
      <div class="logo">
        <img
          src="data:image/png;base64, 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"
          alt="DIPLAB"
        />
      </div>

      <!-- HEADER -->
      <p class="greeting">Hallo, ${studentInfo?.name || 'Peminjam'}</p>
      <h2 class="title-danger">Penyewaan Disetujui!</h2>

      <!-- DETAIL -->
      <div class="details">
        <h3>Detail Penyewaan Barang</h3>

        <div class="detail-items">
          <div class="detail-row">
            <span>Barang yang disewa</span>
            <span>${stringifiedItems}</span>
          </div>

          <div class="detail-row">
            <span>Tanggal pengambilan</span>
            <span>${dayjs(booking?.startDate).format('DD MM YYYY')}</span>
          </div>
        </div>
      </div>

      <!-- INFO -->
      <div class="info-box">
        <div class="info-icon">!</div>

        <div class="info-content">
          <strong>Informasi</strong>
          <p>
            Permintaan peminjaman anda sudah disetujui, harap melakukan pengambilan dan pengembalian barang sesuai dengan jadwal yang telah ditentukan.
          </p>
        </div>
      </div>
    </div>
  </body>
</html>

      `,
    });

    return res.status(200).json({
      success: true,
      message: 'Booking approved successfully',
      data: populated || updated,
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
      { new: true },
    ).lean();
    if (!updated) return res.status(404).json({ error: 'not found' });
    console.log('status', status);
    if (status === 'rejected') {
      const updatedId = (updated as any)._id;
      const populated = await Booking.findById(updatedId)
        .populate('studentId', 'name email')
        .populate('items.id', 'name')
        .lean();

      const studentInfo = ((populated as any)?.studentId || {}) as any;

      const stringifiedItems = ((populated as any)?.items || [])
        .map((item: any) => item.id.name + ' x' + item.quantity)
        .join(', ');

      resend.emails.send({
        from: 'diplab@nopidekha.dev',
        to: 'delishaunimus@gmail.com',
        subject: 'Diplab - Booking Disetujui',
        html: `
      <!doctype html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <title>Notifikasi Penyewaan</title>
    <style>
      /* BODY */
      body.notif-body {
        background-color: #f7f8fa;
        padding: 60px 0;
        font-family: 'Poppins', sans-serif;
      }

      /* CONTAINER */
      .email-container {
        max-width: 900px;
        margin: 90px auto;
        background: #ffffff;
        border-radius: 10px;
        border: 1px solid #0067e5;
        padding: 30px 70px 30px 70px;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
      }

      /* LOGO */
      .logo img {
        max-width: 140px;
        margin-bottom: 20px;
      }

      /* HEADER */
      .greeting {
        text-align: center;
        color: #444;
      }

      .title-danger {
        text-align: center;
        color: #ff2d2dff;
        margin-bottom: 30px;
        font-size: 20px;
      }

      /* DETAILS */
      .details {
        background: #edeffe;
        border-radius: 15px;
        padding: 20px 20px 20px 20px;
        margin-bottom: 20px;
        text-align: left;
      }

      .detail-title {
        padding-right: 200px !important;
      }

      .details h3 {
        margin-bottom: 25px;
      }

      .detail-items {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .detail-row {
        display: grid;
        grid-template-columns: 250px 1fr;
        font-size: 14px;
      }

      /* INFO BOX */
      .info-box {
        display: flex;
        gap: 15px;
        background: #eef1ff;
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 30px;
      }

      .info-icon {
        width: 95px;
        height: 36px;
        background: #ffcc00;
        color: #fff;
        font-weight: bold;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .info-content p {
        margin: 9px 0;
        font-size: 15px;
      }

      .contact {
        font-weight: bold;
      }

      /* BUTTON */
      .btn-primary {
        display: block;
        text-align: center;
        background: #1e66ff;
        color: #fff;
        padding: 12px;
        border-radius: 8px;
        text-decoration: none;
        font-weight: 600;
      }
    </style>
  </head>

  <body class="notif-body">
    <div class="email-container">
      <!-- LOGO -->
      <div class="logo">
        <img
          src="data:image/png;base64, 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"
          alt="DIPLAB"
        />
      </div>

      <!-- HEADER -->
      <p class="greeting">Hallo, ${studentInfo?.name || 'Peminjam'}</p>
      <h2 class="title-danger">Penyewaan Ditolak!</h2>

      <!-- DETAIL -->
      <div class="details">
        <h3>Detail Penyewaan Barang</h3>

        <div class="detail-items">
          <div class="detail-row">
            <span>Barang yang disewa</span>
            <span>${stringifiedItems}</span>
          </div>
        </div>
      </div>

      <!-- INFO -->
      <div class="info-box">
        <div class="info-icon">!</div>

        <div class="info-content">
          <strong>Informasi</strong>
          <p>
            Mohon maaf, permintaan peminjaman Anda belum dapat disetujui oleh admin karena beberapa alasan. Silakan hubungi admin untuk informasi lebih lanjut.
          </p>
        </div>
      </div>

      <a href="https://diplab.nopidekha.dev/" class="btn-primary"
        >Ajukan Ulang Peminjaman</a
      >
    </div>
  </body>
</html>

      `,
      });
      console.log(`Sent rejection email to ${studentInfo?.email}`);
    }

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
