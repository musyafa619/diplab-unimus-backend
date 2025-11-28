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

    const item = await Item.create({ name, quantity: qty, imageUrl });
    const out = item.toObject();
    delete (out as any).__v;
    return res.status(201).json(out);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function listItems(req: Request, res: Response) {
  try {
    const items = await Item.find().sort({ createdAt: 1 }).lean();
    const out = items.map((i) => {
      const { __v, ...rest } = i as any;
      return rest;
    });
    return res.json(out);
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
    const { __v, ...rest } = item as any;
    return res.json(rest);
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
