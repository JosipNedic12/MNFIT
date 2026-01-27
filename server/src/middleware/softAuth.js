import mongoose from 'mongoose';
import User from '../models/User.js';

export default async function softAuth(req, res, next) {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      req.user = null;
      return next();
    }

    if (!mongoose.isValidObjectId(userId)) {
      req.user = null;
      return next();
    }

    const user = await User.findById(userId).lean();
    req.user = user ?? null;

    // Ako je session pokazivao na usera koji više ne postoji, očisti session
    if (!user) req.session.userId = undefined;

    next();
  } catch (err) {
    next(err);
  }
}
