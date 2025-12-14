import { Request, Response } from 'express';
import fs from 'fs/promises';
import Item from '../models/item';
import cloudinary from '../config/cloudinary';

export async function createItem(req: Request, res: Response) {
  try {
    const { name, quantity } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const qty = typeof quantity === 'number' ? quantity : Number(quantity || 0);

    let imageUrl: string | undefined = undefined;
    const file = (req as any).file;
    if (file && file.path) {
      try {
        const result: any = await cloudinary.uploader.upload(file.path, {
          resource_type: 'image',
        });
        imageUrl = result?.secure_url;
      } finally {
        try {
          await fs.unlink(file.path);
        } catch (e) {
          /* ignore */
        }
      }
    }

    await Item.create({ name, quantity: qty, imageUrl });

    return res.status(201).json({
      success: true,
      message: 'Item created successfully',
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function getListItems(req: Request, res: Response) {
  try {
    // optional search param to filter by name (case-insensitive, partial)
    const search =
      typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (search) {
      // partial, case-insensitive match on `name`
      filter.name = { $regex: search, $options: 'i' };
    }

    // Sorting
    // supported sort fields to avoid arbitrary field injection
    const allowedSortFields = ['name', 'quantity', 'updatedAt'];
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

    const [total, items] = await Promise.all([
      Item.countDocuments(filter).exec(),
      Item.find(filter)
        .sort({ [sortBy]: order })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const out = items.map((i) => {
      const { __v, _id, ...rest } = i as any;
      return { ...rest, id: _id.toString() };
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

export async function getItemById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    // `id` is a MongoDB ObjectId string now
    const item = await Item.findById(id).lean();
    if (!item) return res.status(404).json({ error: 'not found' });
    const { __v, _id, ...rest } = item as any;
    return res.json({ ...rest, id: _id.toString() });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function updateItem(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, quantity } = req.body;
    const update: any = {};
    if (name !== undefined) update.name = name;
    if (quantity !== undefined) update.quantity = Number(quantity);

    const file = (req as any).file;
    if (file && file.path) {
      try {
        const result: any = await cloudinary.uploader.upload(file.path, {
          resource_type: 'image',
        });
        update.imageUrl = result?.secure_url;
      } finally {
        try {
          await fs.unlink(file.path);
        } catch (e) {
          /* ignore */
        }
      }
    }

    const updated = await Item.findByIdAndUpdate(
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

export async function deleteItem(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const removed = await Item.findByIdAndDelete(id).lean();
    if (!removed) return res.status(404).json({ error: 'not found' });
    const { __v, ...rest } = removed as any;
    return res.json(rest);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
