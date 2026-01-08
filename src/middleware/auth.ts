import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import Admin from '../models/admin';

const JWT_SECRET = process.env.JWT_SECRET || 'please_change_this_secret';

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Simple cookie-based middleware: prefer `token` then `jwt` cookie
    const token = req.cookies?.token ?? req.cookies?.jwt;
    if (!token) {
      return res
        .status(401)
        .json({ error: 'Unauthorized - No Token Provided' });
    }

    let payload: any;
    try {
      payload = (jwt as any).verify(token, JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const adminId = payload?.id ?? payload?.userId;
    if (!adminId) return res.status(401).json({ error: 'Unauthorized' });

    const admin = await Admin.findById(adminId).lean();
    if (!admin) return res.status(404).json({ error: 'User not found' });

    // cast admin to any to avoid lean() type mismatches from mongoose typings
    const a: any = admin;
    req.user = { id: a._id.toString(), username: a.username };

    next();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('authMiddleware error', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
