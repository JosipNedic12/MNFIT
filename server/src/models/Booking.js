import mongoose from 'mongoose';

const BookingSchema = new mongoose.Schema({
  termId: { type: mongoose.Schema.Types.ObjectId, ref: 'Term', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum: ['active', 'cancelled', 'term_cancelled'], default: 'active' },
  cancelledAt: { type: Date, default: null }
}, { timestamps: true });

BookingSchema.index({ termId: 1, userId: 1 }, { unique: true });

export default mongoose.model('Booking', BookingSchema);
