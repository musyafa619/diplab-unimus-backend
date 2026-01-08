import { Request, Response } from 'express';
import Student from '../models/student';
import Major from '../models/major';

export async function createStudent(req: Request, res: Response) {
  try {
    const { name, nim, phoneNumber, email, majorId } = req.body;
    if (!name || !nim || !majorId)
      return res
        .status(400)
        .json({ error: 'name, nim and majorId are required' });

    // ensure major exists
    const major = await Major.findById(majorId).lean();
    if (!major) return res.status(400).json({ error: 'invalid majorId' });

    await Student.create({
      name,
      nim,
      phoneNumber,
      email,
      majorId,
    });
    return res.status(201).json({
      success: true,
      message: 'Student created successfully',
    });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error(err);
    if (err.code === 11000) {
      return res.status(409).json({ error: 'duplicate nim' });
    }
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function listStudents(req: Request, res: Response) {
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
    const allowedSortFields = ['name', 'nim', 'email', 'updatedAt'];
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

    const [total, students] = await Promise.all([
      Student.countDocuments({}).exec(),
      Student.find(filter)
        .sort({ [sortBy]: order })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const out = students.map((s) => {
      const { __v, _id, ...rest } = s as any;
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

export async function getStudentById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const student = await Student.findById(id).lean();
    if (!student) return res.status(404).json({ error: 'not found' });
    const { __v, _id, ...rest } = student as any;
    return res.json({ ...rest, id: _id.toString() });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function updateStudent(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, nim, phoneNumber, email, majorId } = req.body;

    const update: any = {};
    if (name !== undefined) update.name = name;
    if (nim !== undefined) update.nim = nim;
    if (phoneNumber !== undefined) update.phoneNumber = phoneNumber;
    if (email !== undefined) update.email = email;
    if (majorId !== undefined) {
      // validate major
      const major = await Major.findById(majorId).lean();
      if (!major) return res.status(400).json({ error: 'invalid majorId' });
      update.majorId = majorId;
    }

    const updated = await Student.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true }
    ).lean();
    if (!updated) return res.status(404).json({ error: 'not found' });

    return res.json({
      success: true,
      message: 'Student update successfully',
    });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error(err);
    if (err.code === 11000) {
      return res.status(409).json({ error: 'duplicate nim' });
    }
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function deleteStudent(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const removed = await Student.findByIdAndDelete(id).lean();
    if (!removed) return res.status(404).json({ error: 'not found' });
    const { __v, ...rest } = removed as any;
    return res.json({
      success: true,
      message: 'Student delete successfully',
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
