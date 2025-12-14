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

    const student = await Student.create({
      name,
      nim,
      phoneNumber,
      email,
      majorId,
    });
    const out = student.toObject();
    delete (out as any).__v;
    return res.status(201).json(out);
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
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const [total, students] = await Promise.all([
      Student.countDocuments({}).exec(),
      Student.find().sort({ createdAt: 1 }).skip(skip).limit(limit).lean(),
    ]);

    const out = students.map((s) => {
      const { __v, ...rest } = s as any;
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

export async function getStudentById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const student = await Student.findById(id).lean();
    if (!student) return res.status(404).json({ error: 'not found' });
    const { __v, ...rest } = student as any;
    return res.json(rest);
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
    const { __v, ...rest } = updated as any;
    return res.json(rest);
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
    return res.json(rest);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
