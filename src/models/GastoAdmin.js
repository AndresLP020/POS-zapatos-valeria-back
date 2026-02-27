import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  id: { type: Number, required: true },
  fecha: String,
  descripcion: String,
  categoria: String,
  monto: Number,
});
export const GastoAdmin = mongoose.model('GastoAdmin', schema);
