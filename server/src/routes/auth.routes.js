import { Router } from 'express';
import User from '../models/User.js';
import softAuth from '../middleware/softAuth.js';
import auth from '../middleware/auth.js';
import bcrypt from 'bcryptjs';
const router = Router();
router.post('/register', async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, password2 } = req.body;

    if (!firstName || !lastName || !email || !password || !password2) {
      return res.status(400).json({ error: 'Missing fields' });
    }
    if (password !== password2) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    const exists = await User.findOne({ email: normalizedEmail }).lean();
    if (exists) return res.status(409).json({ error: 'Email already in use' });

    const passwordHash = await bcrypt.hash(password, 10); // cost factor 10 je standardno ok za start [web:356]

    const user = await User.create({
      firstName,
      lastName,
      email: normalizedEmail,
      passwordHash,
      role: 'member'
    });

    // opcija A: nakon registracije ne logiramo automatski
    res.status(201).json({ ok: true, message: 'Registered. Please login.' });
  } catch (e) {
    // fallback ako unique index uhvati race
    if (e?.code === 11000) return res.status(409).json({ error: 'Email already in use' });
    next(e);
  }
});
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email).toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    req.session.userId = user._id;

    res.json({
      user: {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });
  } catch (e) { next(e); }
});


router.get('/me', async (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ user: null });

  const user = await User.findById(req.session.userId).lean();
  if (!user) return res.status(401).json({ user: null });

  res.json({
    user: { _id: user._id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role }
  });
});

router.post('/logout', (req, res, next) => {
  const cookieName = 'mnfit.sid';

  if (!req.session) {
    res.clearCookie(cookieName);
    return res.json({ ok: true });
  }

  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie(cookieName);
    res.json({ ok: true });
  });
});



export default router;
