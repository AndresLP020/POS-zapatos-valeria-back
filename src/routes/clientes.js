import { Router } from 'express';
import { getNextId } from '../db.js';
import { Cliente } from '../models/Cliente.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const clientes = await Cliente.find().sort({ id: 1 }).lean();
    res.json(clientes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const c = await Cliente.findOne({ id: Number(req.params.id) }).lean();
    if (!c) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(c);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { nombre, telefono, email, direccion } = req.body;
    if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
    const id = await getNextId(Cliente);
    const nuevo = await Cliente.create({
      id,
      nombre: nombre.trim(),
      telefono: (telefono && telefono.trim()) || '',
      email: (email && email.trim()) || '',
      direccion: (direccion && direccion.trim()) || '',
    });
    res.status(201).json(nuevo.toObject());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const doc = await Cliente.findOne({ id: Number(req.params.id) });
    if (!doc) return res.status(404).json({ error: 'Cliente no encontrado' });
    const { nombre, telefono, email, direccion } = req.body;
    if (nombre != null) doc.nombre = nombre.trim();
    if (telefono != null) doc.telefono = telefono.trim();
    if (email != null) doc.email = email.trim();
    if (direccion != null) doc.direccion = direccion.trim();
    await doc.save();
    res.json(doc.toObject());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const r = await Cliente.deleteOne({ id: Number(req.params.id) });
    if (r.deletedCount === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
