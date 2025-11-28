import 'express-serve-static-core';

declare global {
  namespace Express {
    interface Request {
      // set by `authMiddleware` when a valid JWT is present
      user?: { id: string; username: string };
    }
  }
}

export {};
