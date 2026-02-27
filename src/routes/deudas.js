import { Router } from 'express';
import { getNextId } from '../db.js';
import { MetaAhorro } from '../models/MetaAhorro.js';
import { RegistroAhorro } from '../models/RegistroAhorro.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const list = await MetaAhorro.find().sort({ id: 1 }).lean();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:metaId/registros', async (req, res) => {
  try {
    const metaId = Number(req.params.metaId);
    const list = await RegistroAhorro.find({ metaId }).sort({ fecha: 1 }).lean();
    res.json(list.map((r) => ({ fecha: r.fecha, monto: r.monto })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:metaId/dias', async (req, res) => {
  try {
    const metaId = Number(req.params.metaId);
    const { fecha, monto } = req.body;
    const fechaStr = fecha ? String(fecha).trim().slice(0, 10) : null;
    const montoNum = Number(monto);
    if (!fechaStr) return res.status(400).json({ error: 'fecha es requerida' });
    const doc = await RegistroAhorro.findOneAndUpdate(
      { metaId, fecha: fechaStr },
      { $set: { monto: montoNum >= 0 ? montoNum : 0 } },
      { upsert: true, new: true }
    );
    res.json({ fecha: doc.fecha, monto: doc.monto });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { nombre, meta, fechaLimite } = req.body;
    const metaNum = Number(meta);
    if (!nombre || nombre.trim() === '' || !metaNum || metaNum <= 0 || !fechaLimite || fechaLimite.trim() === '') {
      return res.status(400).json({ error: 'Nombre, meta (mayor a 0) y fecha límite son requeridos' });
    }
    const id = await getNextId(MetaAhorro);
    const doc = await MetaAhorro.create({
      id,
      nombre: nombre.trim(),
      meta: metaNum,
      fechaLimite: fechaLimite.trim().slice(0, 10),
      estado: 'activa',
    });
    res.status(201).json(doc.toObject());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const doc = await MetaAhorro.findOne({ id: Number(req.params.id) });
    if (!doc) return res.status(404).json({ error: 'Meta de ahorro no encontrada' });
    const { nombre, meta, fechaLimite, estado } = req.body;
    if (nombre != null) doc.nombre = String(nombre).trim();
    if (meta != null) {
      const n = Number(meta);
      if (n > 0) doc.meta = n;
    }
    if (fechaLimite != null) doc.fechaLimite = String(fechaLimite).trim().slice(0, 10);
    if (estado != null) doc.estado = estado;
    await doc.save();
    res.json(doc.toObject());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const r = await MetaAhorro.deleteOne({ id: Number(req.params.id) });
    if (r.deletedCount === 0) return res.status(404).json({ error: 'Meta de ahorro no encontrada' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
