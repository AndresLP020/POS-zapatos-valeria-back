import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema({
  empleadoId: Number,
  nombre: String,
  monto: Number,
  diasTrabajados: { type: Number, default: 7 },
  semana: String,
  adelantoDescontado: { type: Number, default: 0 },
}, { _id: false });

const schema = new mongoose.Schema({
  id: { type: Number, required: true },
  fecha: String,
  items: [itemSchema],
  total: Number,
});

export const Nomina = mongoose.model('Nomina', schema);
