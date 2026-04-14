import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  id: { type: Number, required: true },
  fecha: { type: String, required: true },
  productoId: { type: Number, required: true },
  productoNombre: { type: String, required: true },
  origen: { type: String, enum: ['bodega', 'tienda'], required: true },
  destino: { type: String, enum: ['bodega', 'tienda'], required: true },
  cantidad: { type: Number, required: true },
  estado: { type: String, enum: ['solicitado', 'autorizado'], default: 'autorizado' },
  solicitadoPorId: Number,
  solicitadoPor: String,
  autorizadoPorId: Number,
  autorizadoPor: String,
  recogidoPorId: Number,
  recogidoPor: String,
});

export const MovimientoInventario = mongoose.model('MovimientoInventario', schema);
