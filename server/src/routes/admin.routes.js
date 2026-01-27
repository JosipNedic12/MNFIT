import { Router } from 'express';
import mongoose from 'mongoose';
import auth from '../middleware/auth.js';
import softAuth from '../middleware/softAuth.js';
import requireRole from '../middleware/requireRole.js';
import User from '../models/User.js';

const router = Router();

function ensureObjectId(id) {
  return mongoose.isValidObjectId(id);
}

// GET /admin/users  (admin only)
router.get('/users', auth, softAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const users = await User.find({})
      .select('_id firstName lastName email role createdAt')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ users });
  } catch (e) { next(e); }
});

// PATCH /admin/users/:id/role  (admin only)
router.patch('/users/:id/role', auth, softAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!ensureObjectId(id)) return res.status(400).json({ error: 'Invalid user id' });

    const allowedRoles = ['member', 'subscriber', 'trainer', 'admin'];
    if (!allowedRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });

    // opcionalno: zabrani da admin sam sebi skine admin
    if (String(req.user._id) === String(id) && role !== 'admin') {
      return res.status(409).json({ error: 'You cannot remove your own admin role' });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $set: { role } },
      { new: true }
    ).select('_id firstName lastName email role');

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ user });
  } catch (e) { next(e); }
});

export default router;
