import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  metaId: { type: Number, required: true },
  fecha: { type: String, required: true },
  monto: { type: Number, required: true, default: 0 },
});

schema.index({ metaId: 1, fecha: 1 }, { unique: true });

export const RegistroAhorro = mongoose.model('RegistroAhorro', schema);
