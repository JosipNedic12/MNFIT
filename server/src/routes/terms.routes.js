import { Router } from 'express';
import mongoose from 'mongoose';
import Term from '../models/Term.js';
import Booking from '../models/Booking.js';
import auth from '../middleware/auth.js';
import softAuth from '../middleware/softAuth.js';
import requireRole from '../middleware/requireRole.js';

const router = Router();


async function hasOverlap({ startsAt, endsAt, excludeId = null }) {
  const q = {
    status: 'scheduled',
    startsAt: { $lt: endsAt },
    endsAt: { $gt: startsAt }
  };
  if (excludeId) q._id = { $ne: new mongoose.Types.ObjectId(String(excludeId)) };

  const overlap = await Term.findOne(q).lean();
  return !!overlap;
}

function ensureObjectId(id) {
  return mongoose.isValidObjectId(id);
}

/* -------------------- LIST + auto-finish + bookedCount -------------------- */
router.get('/', auth, async (req, res, next) => {
  try {
    const now = new Date();

    await Term.updateMany(
      { status: 'scheduled', startsAt: { $lte: now } },
      { $set: { status: 'finished' } }
    );

const terms = await Term.find({
  status: 'scheduled',
  startsAt: { $gt: now }  
})
.populate('trainerId', 'firstName lastName')
.sort({ startsAt: 1 })
.lean();


    const termIds = terms.map(t => t._id);
    const counts = await Booking.aggregate([
      { $match: { termId: { $in: termIds }, status: 'active' } },
      { $group: { _id: '$termId', bookedCount: { $sum: 1 } } }
    ]);

    const countMap = new Map(counts.map(c => [String(c._id), c.bookedCount]));
    const result = terms.map(t => ({ ...t, bookedCount: countMap.get(String(t._id)) ?? 0 }));

    res.json({ terms: result });
  } catch (e) { next(e); }
});

/* -------------------- CREATE term -------------------- */
router.post('/', auth, softAuth, requireRole('admin', 'trainer'), async (req, res, next) => {
  try {
    const { capacity, startsAt, endsAt, workoutDescription = '', trainerId } = req.body;

    if (!Number.isInteger(capacity) || capacity < 1) {
      return res.status(400).json({ error: 'Invalid capacity' });
    }

    const s = new Date(startsAt);
    const e = new Date(endsAt);

    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
      return res.status(400).json({ error: 'Invalid startsAt/endsAt' });
    }
    if (e <= s) return res.status(400).json({ error: 'endsAt must be after startsAt' });

    // finished čim prođe start (tvoj zahtjev)
    const status = (s <= new Date()) ? 'finished' : 'scheduled';

    // global overlap samo za scheduled
    if (status === 'scheduled') {
      const overlap = await hasOverlap({ startsAt: s, endsAt: e });
      if (overlap) return res.status(409).json({ error: 'Term overlaps existing term' });
    }

    // trainerId: admin može zadati; trener uvijek sebi
    const effectiveTrainerId =
      req.user.role === 'admin'
        ? (trainerId ?? req.user._id)
        : req.user._id;

    const term = await Term.create({
      capacity,
      startsAt: s,
      endsAt: e,
      status,
      trainerId: effectiveTrainerId,
      workoutDescription,
      createdBy: req.user._id
    });

    res.status(201).json({ term });
  } catch (e) { next(e); }
});

/* -------------------- EDIT term (PATCH) -------------------- */
router.patch('/:id', auth, softAuth, requireRole('admin', 'trainer'), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!ensureObjectId(id)) return res.status(400).json({ error: 'Invalid term id' });

    const term = await Term.findById(id);
    if (!term) return res.status(404).json({ error: 'Term not found' });

    // trainer samo svoje termine
    if (req.user.role === 'trainer' && String(term.trainerId) !== String(req.user._id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { capacity, startsAt, endsAt, workoutDescription, trainerId } = req.body;

    if (capacity !== undefined) {
      if (!Number.isInteger(capacity) || capacity < 1) return res.status(400).json({ error: 'Invalid capacity' });
      term.capacity = capacity;
    }

    if (workoutDescription !== undefined) {
      term.workoutDescription = String(workoutDescription);
    }

    if (trainerId !== undefined) {
      if (req.user.role !== 'admin') return res.status(403).json({ error: 'Only admin can change trainerId' });
      if (!ensureObjectId(trainerId)) return res.status(400).json({ error: 'Invalid trainerId' });
      term.trainerId = trainerId;
    }

    const newStartsAt = startsAt ? new Date(startsAt) : term.startsAt;
    const newEndsAt = endsAt ? new Date(endsAt) : term.endsAt;

    if (startsAt || endsAt) {
      if (Number.isNaN(newStartsAt.getTime()) || Number.isNaN(newEndsAt.getTime())) {
        return res.status(400).json({ error: 'Invalid startsAt/endsAt' });
      }
      if (newEndsAt <= newStartsAt) return res.status(400).json({ error: 'endsAt must be after startsAt' });

      const wouldBeFinished = newStartsAt <= new Date();
      // overlap provjeravaj samo ako će term biti scheduled (tj. u budućnosti)
      if (!wouldBeFinished) {
        const overlap = await hasOverlap({
          startsAt: newStartsAt,
          endsAt: newEndsAt,
          excludeId: term._id
        });
        if (overlap) return res.status(409).json({ error: 'Term overlaps existing term' });
      }


      term.startsAt = newStartsAt;
      term.endsAt = newEndsAt;

      // tvoj zahtjev: kad prođe vrijeme početka -> finished
      if (term.startsAt <= new Date()) term.status = 'finished';
    }

    await term.save();
    res.json({ term });
  } catch (e) { next(e); }
});

// DELETE /terms/:id  (admin/trainer)
router.delete('/:id', auth, softAuth, requireRole('admin', 'trainer'), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!ensureObjectId(id)) return res.status(400).json({ error: 'Invalid term id' });

    const term = await Term.findById(id);
    if (!term) return res.status(404).json({ error: 'Term not found' });

    // trainer moze brisati samo svoje termine
    if (req.user.role === 'trainer' && String(term.trainerId) !== String(req.user._id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await Booking.deleteMany({ termId: term._id });
    await Term.deleteOne({ _id: term._id });

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});


/* -------------------- GENERATE WEEK (templates 2/3/4) -------------------- */
const SLOT_TEMPLATES = {
  2: [['13:00', '15:00'], ['17:00', '19:00']],
  3: [['13:00', '15:00'], ['15:00', '17:00'], ['17:00', '19:00']],
  4: [['12:00', '14:00'], ['14:00', '16:00'], ['16:00', '18:00'], ['18:00', '20:00']]
};

function parseHM(hm) {
  const [h, m] = String(hm).split(':').map(Number);
  return { h, m };
}

function nextWeekMonday(fromDate = new Date()) {
  const base = new Date(fromDate);
  base.setHours(0, 0, 0, 0);
  const day = base.getDay(); // 0..6 (ned..sub)
  const diffToMon = (day === 0 ? -6 : 1 - day);
  const thisMon = new Date(base);
  thisMon.setDate(base.getDate() + diffToMon);
  const nextMon = new Date(thisMon);
  nextMon.setDate(thisMon.getDate() + 7);
  return nextMon;
}

router.post('/generate-week', auth, softAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { daysOfWeek, termsPerDay, capacity = 20, workoutDescription = '', trainerId, dateFrom } = req.body;

    if (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0) {
      return res.status(400).json({ error: 'daysOfWeek is required' });
    }
    if (![2, 3, 4].includes(termsPerDay)) {
      return res.status(400).json({ error: 'termsPerDay must be 2, 3 or 4' });
    }
    if (!Number.isInteger(capacity) || capacity < 1) {
      return res.status(400).json({ error: 'Invalid capacity' });
    }

    const base = dateFrom ? new Date(`${dateFrom}T00:00:00`) : new Date();
    const weekStart = nextWeekMonday(base);
    const slots = SLOT_TEMPLATES[termsPerDay];

    const createdDocs = [];
    const skipped = [];

    const effectiveTrainerId = trainerId ?? req.user._id;

    for (const dow of daysOfWeek) {
      if (!Number.isInteger(dow) || dow < 0 || dow > 6) {
        skipped.push({ dow, reason: 'invalid-day' });
        continue;
      }

      const offset = dow === 0 ? 6 : (dow - 1);
      const dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + offset);

      for (const [startHM, endHM] of slots) {
        const { h: sh, m: sm } = parseHM(startHM);
        const { h: eh, m: em } = parseHM(endHM);

        const startsAt = new Date(dayDate);
        startsAt.setHours(sh, sm, 0, 0);

        const endsAt = new Date(dayDate);
        endsAt.setHours(eh, em, 0, 0);

        // ako je start u prošlosti, odmah finished (ali nextWeekMonday bi trebao biti u budućnosti)
        const status = (startsAt <= new Date()) ? 'finished' : 'scheduled';

        if (status === 'scheduled') {
          const overlap = await hasOverlap({ startsAt, endsAt });
          if (overlap) {
            skipped.push({ dow, startsAt, endsAt, reason: 'overlap' });
            continue;
          }
        }

        createdDocs.push({
          capacity,
          startsAt,
          endsAt,
          status,
          trainerId: effectiveTrainerId,
          workoutDescription,
          createdBy: req.user._id
        });
      }
    }

    const inserted = createdDocs.length ? await Term.insertMany(createdDocs) : [];

    res.status(201).json({
      insertedCount: inserted.length,
      skippedCount: skipped.length,
      skipped
    });
  } catch (e) { next(e); }
});

export default router;
