import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import mongoose from 'mongoose';
import MongoStore from 'connect-mongo';
import authRoutes from './src/routes/auth.routes.js';
import termsRoutes from './src/routes/terms.routes.js';
import bookingsRoutes from './src/routes/bookings.routes.js';
import cron from 'node-cron';
import Term from './src/models/Term.js';
import Booking from './src/models/Booking.js';
import adminRoutes from './src/routes/admin.routes.js';

await mongoose.connect(process.env.MONGODB_URI);
const app = express();
app.use(express.json());

// Briši finished termine starije od X dana
const RETENTION_DAYS = 7;

cron.schedule('15 3 * * *', async () => {
  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

    // Termini koji su finished i završili prije cutoff
    const oldTerms = await Term.find({
      status: 'finished',
      endsAt: { $lt: cutoff }
    }).select({ _id: 1 }).lean();

    const ids = oldTerms.map(t => t._id);
    if (!ids.length) return;

    await Booking.deleteMany({ termId: { $in: ids } });
    await Term.deleteMany({ _id: { $in: ids } });

    console.log(`Cleanup: deleted ${ids.length} finished terms (older than ${RETENTION_DAYS}d)`);
  } catch (e) {
    console.error('Cleanup error', e);
  }
});

app.use(cors({
  origin: process.env.CLIENT_ORIGIN,
  credentials: true
}));

// 2) Session store (u Mongo)
app.use(session({
  name: 'mnfit.sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions'
  }),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false
  }
}));
app.use('/admin', adminRoutes);

app.get('/debug-session', (req, res) => {
  res.json({
    hasSession: !!req.session,
    sessionUserId: req.session?.userId ?? null,
    cookieHeader: req.headers.cookie ?? null
  });
});

// Chrome devtools “noise” ruta
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => res.status(204).end());

// Root + health
app.get('/', (req, res) => res.send('MNFIT API running. Try GET /health'));
app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/auth', authRoutes);

app.use('/terms', termsRoutes);
const port = process.env.PORT || 3001;
app.use('/bookings', bookingsRoutes);
// 3) Listen (samo jednom)
app.listen(port, () => console.log('API listening on', port));
