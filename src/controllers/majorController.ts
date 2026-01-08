import { Request, Response } from 'express';
import Major from '../models/major';

export async function createMajor(req: Request, res: Response) {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    await Major.create({ name });

    return res.status(201).json({
      success: true,
      message: 'Major create successfully',
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function listMajors(req: Request, res: Response) {
  try {
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
    const allowedSortFields = ['name', 'updatedAt'];
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

    const [total, majors] = await Promise.all([
      Major.countDocuments({}).exec(),
      Major.find(filter)
        .sort({ [sortBy]: order })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const out = majors.map((m) => {
      const { __v, _id, ...rest } = m as any;
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

export async function getMajorById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const major = await Major.findById(id).lean();
    if (!major) return res.status(404).json({ error: 'not found' });
    const { __v, _id, ...rest } = major as any;
    return res.json({ ...rest, id: _id.toString() });
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

    return res.json({
      success: true,
      message: 'Major update successfully',
    });
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

    return res.json({
      success: true,
      message: 'Major delete successfully',
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
