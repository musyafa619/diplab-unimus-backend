import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import Admin from '../models/admin';

const JWT_SECRET = process.env.JWT_SECRET || 'please_change_this_secret';

export interface AuthPayload {
  id: string;
  username: string;
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const token =
      req.cookies?.token ||
      (req.headers.authorization
        ? String(req.headers.authorization).replace(/^Bearer\s+/i, '')
        : undefined);
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const payload = (jwt as any).verify(token, JWT_SECRET) as AuthPayload;
    if (!payload || !payload.id)
      return res.status(401).json({ error: 'Unauthorized' });

    const admin = await Admin.findById(payload.id).lean();
    if (!admin) return res.status(401).json({ error: 'Unauthorized' });

    (req as any).user = { id: payload.id, username: payload.username };
    next();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('authMiddleware error', err);
    return res.status(401).json({ error: 'Unauthorized' });
  }
}
