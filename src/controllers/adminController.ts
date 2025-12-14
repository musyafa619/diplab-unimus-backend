import { Request, Response } from 'express';
import Admin from '../models/admin';
import bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'please_change_this_secret';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '1h';

const SALT_ROUNDS = 10;

export async function createAdmin(req: Request, res: Response) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res
        .status(400)
        .json({ error: 'username and password are required' });
    }

    const existing = await Admin.findOne({ username }).lean();
    if (existing) {
      return res.status(409).json({ error: 'username already exists' });
    }

    const hash = await bcrypt.hash(password, SALT_ROUNDS);

    const admin = await Admin.create({ username, password: hash });

    const out = admin.toObject();
    delete out.password;

    return res.status(201).json(out);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res
        .status(400)
        .json({ error: 'username and password are required' });

    const admin = await Admin.findOne({ username }).exec();
    if (!admin) return res.status(401).json({ error: 'invalid credentials' });

    const match = await bcrypt.compare(password, admin.password);
    if (!match) return res.status(401).json({ error: 'invalid credentials' });

    const token = (jwt as any).sign(
      { id: admin._id.toString(), username: admin.username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    const cookieOpts: any = {
      httpOnly: true,
      // If the frontend origin is using HTTPS and you want cross-site cookies,
      // set FRONTEND_ORIGIN to an https:// origin and the code below will
      // use `sameSite: 'none'` and `secure: true` so browsers accept the cookie.
      // For local HTTP development (http://localhost:3039) we keep `sameSite: 'lax'`.
      secure:
        process.env.FRONTEND_ORIGIN?.startsWith('https://') ||
        process.env.NODE_ENV === 'production',
      sameSite: process.env.FRONTEND_ORIGIN?.startsWith('https://')
        ? 'none'
        : 'lax',
      maxAge: 1000 * 60 * 60, // 1 hour (matches default JWT_EXPIRES)
    };

    res.cookie('token', token, cookieOpts);

    return res.json({ ok: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function getMe(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    // Return basic user info
    return res.json({ id: user.id, username: user.username });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function logout(req: Request, res: Response) {
  try {
    res.clearCookie('token');
    return res.json({ ok: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
