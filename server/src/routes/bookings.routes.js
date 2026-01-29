import { Router } from 'express';
import mongoose from 'mongoose';
import auth from '../middleware/auth.js';
import softAuth from '../middleware/softAuth.js';
import Booking from '../models/Booking.js';
import Term from '../models/Term.js';

const router = Router();

const MAX_PER_WEEK = 3;

function getWeekRange(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  const day = d.getDay(); // 0..6 (ned..sub)
  const diffToMon = (day === 0 ? -6 : 1 - day);

  const weekStart = new Date(d);
  weekStart.setDate(d.getDate() + diffToMon);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  return { weekStart, weekEnd };
}

async function assertWeeklyLimit(userId, termStartsAt, termIdToIgnore = null) {
  const { weekStart, weekEnd } = getWeekRange(new Date(termStartsAt));

  const matchBookings = {
    userId: new mongoose.Types.ObjectId(String(userId)),
    status: 'active'
  };

  // ako reaktiviraš isti booking, ignoriraj ga u countu
  if (termIdToIgnore) {
    matchBookings.termId = { $ne: new mongoose.Types.ObjectId(String(termIdToIgnore)) };
  }

  const rows = await Booking.aggregate([
    { $match: matchBookings },
    {
      $lookup: {
        from: 'terms',
        localField: 'termId',
        foreignField: '_id',
        as: 'term'
      }
    },
    { $unwind: '$term' },
    {
      $match: {
        'term.startsAt': { $gte: weekStart, $lt: weekEnd }
      }
    },
    { $count: 'cnt' }
  ]);

  const cnt = rows[0]?.cnt ?? 0;
  if (cnt >= MAX_PER_WEEK) {
    const err = new Error(`Weekly limit reached (${MAX_PER_WEEK})`);
    err.statusCode = 409;
    throw err;
  }
}

/* -------------------- JOIN (create or reactivate) -------------------- */
router.post('/', auth, softAuth, async (req, res, next) => {
  try {
    const { termId } = req.body;
    if (!mongoose.isValidObjectId(termId)) return res.status(400).json({ error: 'Invalid termId' });

    const term = await Term.findById(termId).lean();
    if (!term) return res.status(404).json({ error: 'Term not found' });

    // Term mora biti joinable
    if (term.status !== 'scheduled') {
      return res.status(409).json({ error: `Term not joinable (${term.status})` });
    }

    // Booking (ako postoji)
    const existing = await Booking.findOne({ termId, userId: req.user._id });

    // Capacity check (računamo samo active)
    const activeCount = await Booking.countDocuments({ termId, status: 'active' });
    if (activeCount >= term.capacity) return res.status(409).json({ error: 'Term is full' });

    // Weekly limit (vrijedi i za create i za re-join)
    // Ako existing postoji za isti term, ignoriramo taj term u countu (da ne blokira reaktivaciju samog sebe)
    await assertWeeklyLimit(req.user._id, term.startsAt, existing ? termId : null);

    if (existing) {
      if (existing.status === 'active') {
        return res.status(409).json({ error: 'Already booked' });
      }

      // ako je termin cancelan od admin/trainer, user ga ne može sam vratiti
      if (existing.status === 'term_cancelled') {
        return res.status(409).json({ error: 'Term is cancelled. Wait for reactivation.' });
      }

      // existing.status === 'cancelled' -> re-join
      existing.status = 'active';
      existing.cancelledAt = null;
      await existing.save();

      return res.status(200).json({ booking: existing });
    }

    // create novi booking
    const booking = await Booking.create({
      termId,
      userId: req.user._id,
      status: 'active'
    });

    res.status(201).json({ booking });
  } catch (e) {
    if (e?.statusCode === 409) return res.status(409).json({ error: e.message });
    if (e?.code === 11000) return res.status(409).json({ error: 'Already booked' });
    next(e);
  }
});

// USER CANCEL (po termId) - dozvoljeno samo dok je term scheduled
router.post('/cancel-by-term/:termId', auth, softAuth, async (req, res, next) => {
  try {
    const { termId } = req.params;
    if (!mongoose.isValidObjectId(termId)) {
      return res.status(400).json({ error: 'Invalid termId' });
    }

    // 1) provjeri term status
    const term = await Term.findById(termId).select({ status: 1 }).lean();
    if (!term) return res.status(404).json({ error: 'Term not found' });

    if (term.status !== 'scheduled') {
      return res.status(409).json({ error: `Cannot cancel booking (${term.status})` });
    }

    // 2) nađi aktivni booking i otkaži
    const booking = await Booking.findOne({ termId, userId: req.user._id, status: 'active' });
    if (!booking) return res.status(404).json({ error: 'Active booking not found' });

    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    await booking.save();

    res.json({ booking });
  } catch (e) {
    next(e);
  }
});
// GET /bookings/mine (aktivni bookinzi + populated term + trainer)
router.get('/mine', auth, softAuth, async (req, res, next) => {
  try {
    const bookings = await Booking.find({ userId: req.user._id, status: 'active' })
      .sort({ createdAt: -1 })
      .populate({
        path: 'termId',
        select: 'startsAt endsAt capacity status workoutDescription trainerId',
        populate: {
          path: 'trainerId',
          select: 'firstName lastName'
        }
      })
      .lean();
const visible = bookings.filter(b => b.termId && b.termId.status === 'scheduled');
    res.json({ bookings: visible });
  } catch (e) { next(e); }
});



export default router;
