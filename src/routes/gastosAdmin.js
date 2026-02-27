import { Router } from 'express';
import { getNextId } from '../db.js';
import { GastoAdmin } from '../models/GastoAdmin.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const gastos = await GastoAdmin.find().sort({ id: -1 }).lean();
    res.json(gastos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const g = await GastoAdmin.findOne({ id: Number(req.params.id) }).lean();
    if (!g) return res.status(404).json({ error: 'Gasto no encontrado' });
    res.json(g);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { fecha, descripcion, categoria, monto } = req.body;
    const id = await getNextId(GastoAdmin);
    const gasto = await GastoAdmin.create({
      id,
      fecha: fecha ? new Date(fecha).toISOString() : new Date().toISOString(),
      descripcion: descripcion || '',
      categoria: categoria || 'Diversos',
      monto: Number(monto) || 0,
    });
    res.status(201).json(gasto.toObject());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const doc = await GastoAdmin.findOne({ id: Number(req.params.id) });
    if (!doc) return res.status(404).json({ error: 'Gasto no encontrado' });
    const { fecha, descripcion, categoria, monto } = req.body;
    if (fecha != null) doc.fecha = new Date(fecha).toISOString();
    if (descripcion != null) doc.descripcion = descripcion;
    if (categoria != null) doc.categoria = categoria;
    if (monto != null) doc.monto = Number(monto);
    await doc.save();
    res.json(doc.toObject());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const r = await GastoAdmin.deleteOne({ id: Number(req.params.id) });
    if (r.deletedCount === 0) return res.status(404).json({ error: 'Gasto no encontrado' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
