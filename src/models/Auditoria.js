import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  id: { type: Number, required: true },
  fecha: { type: String, required: true },
  tipo: { type: String, required: true }, // venta, inventario_transferencia, usuario_alta, etc.
  modulo: { type: String, required: true }, // ventas, inventario, usuarios, sistema
  descripcion: { type: String, required: true },
  usuarioId: Number,
  usuarioNombre: String,
  metadata: mongoose.Schema.Types.Mixed,
});

export const Auditoria = mongoose.model('Auditoria', schema);
