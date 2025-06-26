import type { Request, Response } from 'express';

import app from '../dist/app.js';

export default function handler(req: Request, res: Response) {
  return app(req, res);
}
