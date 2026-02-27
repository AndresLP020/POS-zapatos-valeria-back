import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  id: { type: Number, required: true },
  nombre: { type: String, required: true },
  telefono: String,
  email: String,
  direccion: String,
});
export const Proveedor = mongoose.model('Proveedor', schema);
