import mongoose from 'mongoose';
const schema = new mongoose.Schema({ nombre: { type: String, required: true, unique: true } });
export const Categoria = mongoose.model('Categoria', schema);
