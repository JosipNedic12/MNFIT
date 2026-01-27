import mongoose from 'mongoose';

const TermSchema = new mongoose.Schema({
  capacity: { type: Number, required: true, min: 1 },
  startsAt: { type: Date, required: true, index: true },
  endsAt: { type: Date, required: true, index: true },

  status: { type: String, enum: ['scheduled', 'cancelled', 'finished'], default: 'scheduled', index: true },

  trainerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  workoutDescription: { type: String, default: '' },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

export default mongoose.model('Term', TermSchema);
