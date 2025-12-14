import { Request, Response } from 'express';
import Major from '../models/major';

export async function createMajor(req: Request, res: Response) {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const major = await Major.create({ name });
    const out = major.toObject();
    delete (out as any).__v;
    return res.status(201).json(out);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function listMajors(req: Request, res: Response) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const [total, majors] = await Promise.all([
      Major.countDocuments({}).exec(),
      Major.find().sort({ createdAt: 1 }).skip(skip).limit(limit).lean(),
    ]);

    const out = majors.map((m) => {
      const { __v, ...rest } = m as any;
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

export async function getMajorById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const major = await Major.findById(id).lean();
    if (!major) return res.status(404).json({ error: 'not found' });
    const { __v, ...rest } = major as any;
    return res.json(rest);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function updateMajor(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const update: any = {};
    if (name !== undefined) update.name = name;

    const updated = await Major.findByIdAndUpdate(
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

export async function deleteMajor(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const removed = await Major.findByIdAndDelete(id).lean();
    if (!removed) return res.status(404).json({ error: 'not found' });
    const { __v, ...rest } = removed as any;
    return res.json(rest);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
