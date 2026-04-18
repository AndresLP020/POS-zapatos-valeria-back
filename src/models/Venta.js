import mongoose from 'mongoose';
const itemSchema = new mongoose.Schema({ id: Number, nombre: String, precio: Number, cantidad: Number, costo: Number });
const schema = new mongoose.Schema({
  id: { type: Number, required: true },
  fecha: { type: String, required: true },
  items: [itemSchema],
  total: Number,
  pagado: Number,
  pendiente: Number,
  cliente: String,
  clienteId: Number,
  estado: String,
  vendedorId: Number,
  vendedorNombre: String,
  /** 'migracion' = deuda cargada manualmente (sin movimiento de inventario) */
  origen: { type: String, required: false },
});
export const Venta = mongoose.model('Venta', schema);
