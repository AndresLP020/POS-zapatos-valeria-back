import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  id: { type: Number, required: true },
  nombre: String,
  codigo: String,
  categoria: String,
  precio: Number,
  costo: Number,
  stock: Number,
  stockBodega: { type: Number, default: 0 },
  stockMinimo: Number,
  estado: { type: String, default: 'Activo' },
  proveedorId: Number,
});

export const Producto = mongoose.model('Producto', schema);
