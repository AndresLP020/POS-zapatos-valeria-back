import mongoose from 'mongoose';

const itemDevolucionSchema = new mongoose.Schema({
  productoId: { type: Number, required: true },
  nombre: { type: String, required: true },
  cantidad: { type: Number, required: true },
  precio: { type: Number, required: true },
  tipo: { type: String, enum: ['revendible', 'perdida'], required: true },
});

const schema = new mongoose.Schema({
  id: { type: Number, required: true },
  fecha: { type: String, required: true },
  ventaId: { type: Number, default: 0 },
  items: [itemDevolucionSchema],
});

export const Devolucion = mongoose.model('Devolucion', schema);
