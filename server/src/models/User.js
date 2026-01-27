import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
role: {
  type: String,
  enum: ['member', 'subscriber', 'trainer', 'admin'],
  default: 'member',
  index: true
},
firstName: { type: String, required: true, trim: true },
lastName: { type: String, required: true, trim: true },
email: { type: String, required: true, unique: true, lowercase: true, trim: true },
passwordHash: { type: String, required: true }

}, { timestamps: true });

export default mongoose.model('User', UserSchema);
