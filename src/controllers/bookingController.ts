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

    if (studentInfo?.email) {
      resend.emails.send({
        from: 'diplab@nopidekha.dev',
        to: studentInfo.email,
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
          src="data:image/png;base64, iVBORw0KGgoAAAANSUhEUgAAAisAAAClCAYAAACdi72pAAAACXBIWXMAACE4AAAhOAFFljFgAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAABbOSURBVHgB7d1fdhNXtsfxfaqMb+4fWJpBK+8XYkYQMYHYGUHMCICHNrT5JwLxdZKHOCPAGQGiJ4AYQRRI1uo3lBG00vy5ieyqc/cpybmEgJGls0tS1fez2m0csgyxy6pf7bPPPiIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACwAd5J/+fTZjU3npCnLZ+ATGaT6XkZv/UGv05caaaxtNPNcNiUy76X3/GmnIwbOnNtoyxLRa6wf3ut11h//o55eZwOpmL9u39x04poS2X+sJnvtdrtyX69Fs7V9qy2RefH9r3fu7ktFXGu3m/kw35Rl5/wg8TLIvb5PVwZJLoPVVekv48/ZipzMZ977liyjrPjf706fXQ/vwjes58T3xCU/J4n0pKI3GNXU791tic7t6/+ZhBWbv6+h7A/vCuE604Df01DXd879ML7Gust8jSXO5nXg119lX0Y/kzASgqb+ZEX/uQpPvXoD7FQmbB4eNvW/arlef97Gi+Thvb4I5XlW/PpwqIH1+s2Bfs96+vsD7+Rx4tLeByvSW+Tv30nDStU09K3lxbVCiSAb32XOnFvXb6LvJmnyWJb8xoL500trTd+t6Q1+4/VrLFSl0tQ91OvLJOwBb9IblNkN+NUwv6zv2oLF56WhOaY1/vVG7jP9/oWq242ePlR1nUsf7t5rd2WBJII/CTcXDTCXs8w/0Ld/6tPxo7AEFpZSBIhgHGA2wzWm11e4xu7r9dUSwMjWjRsb+q4pZvwlfTJvCJaY04cquaxVmEdb2zefXb1+835YEpMFQFiZTEt/EO/rjeUZNxUYCC/wIbhoKF5/RjCGBefdJbHVGFdXUA1NDS6b+TALoeXRtRvtlswRYeXk/nBTESCu5jgYPzpz7pPbhBbEEJ6O9cbTEnP+M0HlhGsnVFuK0DKnSgthZXrNcFMhtMCI3lxcexRaNnhaxUz8QVZWs2hz3k/gsFOEFq20bG3fKr35mLAyuyahBYbCLq5vwvVFlQXTGFdVNqUk3mfLv4sG7+HboaelzCoLYSWe5lFo4aYCA83QMxWWhgQ4gRKrKqM/T5++qa7UQlOrLI+2t7fXpASElfhGN5Wzn3yjoYXOeEQVloY0ED/g2sKkyulVefPPpLpSE81DSUsJLIQVI+Otz99TZYGBDa4tTGI0BK78qeMhILGNuTYaZQQWwootSvewEq6tRwQWHMdyCNz7sI25VorAYtnDQlgpQSjdh2UhAeIisOCd5lVV+X8MiauZRj48fCBGCCslCctCZ86tf0+vASJr5rmnhwV/Es5wkvliSFztuDWLgzIDwkqJwoh1eg0QW7iu8ixnqRG/K28I3Pt466m5WDg2FTXCSvko3SO6ULk7fe5TpoeiUPZ25WM0tv5WnEmE+jCpqBFW5oPSPeLz+R7XFMoeAvc+LnFUV2onfnVlRTAX4yWh0Ix0QYA4GnpNhUbui4LaWqCqSuFoSNzuvXZXas7rz+bXO3f3xVCxI+fwsJnr64HLdSnQuY/msCTYePVbtqnv9ySShQgrzvlvtcgzEAu5NLyTv0g42db5Nb1aFunJsxV2Cf3r6d+vCMqi15mL/vV2Tprja+2jOV9nm//13xvfvfix0xXUzmV9mvXDrCULZjwkriswt9tu9/Vdf/xhJ/xfqHL8Osw2cqdVLu9LmTjrElmXqoWVJEn2Br1OX0oQyuSHh7KWJNLStPmx/hi1ZI5Gu4Q2fv7Xk0... (line truncated to 2000 chars)
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
    }

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

      if (studentInfo?.email) {
        resend.emails.send({
          from: 'diplab@nopidekha.dev',
          to: studentInfo.email,
          subject: 'Diplab - Booking Ditolak',
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
          src="data:image/png;base64, iVBORw0KGgoAAAANSUhEUgAAAisAAAClCAYAAACdi72pAAAACXBIWXMAACE4AAAhOAFFljFgAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAABbOSURBVHgB7d1fdhNXtsfxfaqMb+4fWJpBK+8XYkYQMYHYGUHMCICHNrT5JwLxdZKHOCPAGQGiJ4AYQRRI1uo3lBG00vy5ieyqc/cpybmEgJGls0tS1fez2m0csgyxy6pf7bPPPiIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACwAd5J/+fTZjU3npCnLZ+ATGaT6XkZv/UGv05caaaxtNPNcNiUy76X3/GmnIwbOnNtoyxLRa6wf3ut11h//o55eZwOpmL9u39x04poS2X+sJnvtdrtyX69Fs7V9qy2RefH9r3fu7ktFXGu3m/kw35Rl5/wg8TLIvb5PVwZJLoPVVekv48/ZipzMZ977liyjrPjf706fXQ/vwjes58T3xCU/J4n0pKI3GNXU791tic7t6/+ZhBWbv6+h7A/vCuE604Df01DXd879ML7Gust8jSXO5nXg119lX0Y/kzASgqb+ZEX/uQpPvXoD7FQmbB4eNvW/arlef97Gi+Thvb4I5XlW/PpwqIH1+s2Bfs96+vsD7+Rx4tLeByvSW+Tv30nDStU09K3lxbVCiSAb32XOnFvXb6LvJmnyWJb8xoL500trTd+t6Q1+4/VrLFSl0tQ91OvLJOwBb9IblNkN+NUwv6zv2oLF56WhOaY1/vVG7jP9/oWq242ePlR1nUsf7t5rd2WBJII/CTcXDTCXs8w/0Ld/6tPxo7AEFpZSBIhgHGA2wzWm11e4xu7r9dUSwMjWjRsb+q4pZvwlfTJvCJaY04cquaxVmEdb2zefXb1+835YEpMFQFiZTEt/EO/rjeUZNxUYCC/wIbhoKF5/RjCGBefdJbHVGFdXUA1NDS6b+TALoeXRtRvtlswRYeXk/nBTESCu5jgYPzpz7pPbhBbEEJ6O9cbTEnP+M0HlhGsnVFuK0DKnSgthZXrNcFMhtMCI3lxcexRaNnhaxUz8QVZWs2hz3k/gsFOEFq20bG3fKr35mLAyuyahBYbCLq5vwvVFlQXTGFdVNqUk3mfLv4sG7+HboaelzCoLYSWe5lFo4aYCA83QMxWWhgQ4gRKrKqM/T5++qa7UQlOrLI+2t7fXpASElfhGN5Wzn3yjoYXOeEQVloY0ED/g2sKkyulVefPPpLpSE81DSUsJLIQVI+Otz99TZYGBDa4tTGI0BK78qeMhILGNuTYaZQQWwootSvewEq6tRwQWHMdyCNz7sI25VorAYtnDQlgpQSjdh2UhAeIisOCd5lVV+X8MiauZRj48fCBGCCslCctCZ86tf0+vASJr5rmnhwV/Es5wkvliSFztuDWLgzIDwkqJwoh1eg0QW7iu8ixnqRG/K28I3Pt466m5WDg2FTXCSvko3SO6ULk7fe5TpoeiUPZ25WM0tv5WnEmE+jCpqBFW5oPSPeLz+R7XFMoeAvc+LnFUV2onfnVlRTAX4yWh0Ix0QYA4GnpNhUbui4LaWqCqSuFoSNzuvXZXas7rz+bXO3f3xVCxI+fwsJnr64HLdSnQuY/msCTYePVbtqnv9ySShQgrzvlvtcgzEAu5NLyTv0g42db5Nb1aFunJsxV2Cf3r6d+vCMqi15mL/vV2Tprja+2jOV9nm//13xvfvfix0xXUzmV9mvXDrCULZjwkriswt9tu9/Vdf/xhJ/xfqHL8Osw2cqdVLu9LmTjrElmXqoWVJEn2Br1OX0oQyuSHh7KWJNLStPmx/hi1ZI5Gu4Q2fv7Xk0... (line truncated to 2000 chars)
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
        console.log(`Sent rejection email to ${studentInfo.email}`);
      }
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
