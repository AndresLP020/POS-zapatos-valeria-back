import { Router } from 'express';
import { getNextId } from '../db.js';
import { Empleado } from '../models/Empleado.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const empleados = await Empleado.find().sort({ id: 1 }).lean();
    res.json(empleados);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const e = await Empleado.findOne({ id: Number(req.params.id) }).lean();
    if (!e) return res.status(404).json({ error: 'Empleado no encontrado' });
    res.json(e);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { nombre, sueldo, puesto } = req.body;
    const id = await getNextId(Empleado);
    const empleado = await Empleado.create({
      id,
      nombre: nombre || '',
      sueldo: Number(sueldo) || 0,
      puesto: puesto || '',
    });
    res.status(201).json(empleado.toObject());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const doc = await Empleado.findOne({ id: Number(req.params.id) });
    if (!doc) return res.status(404).json({ error: 'Empleado no encontrado' });
    const { nombre, sueldo, puesto } = req.body;
    if (nombre != null) doc.nombre = nombre;
    if (sueldo != null) doc.sueldo = Number(sueldo);
    if (puesto != null) doc.puesto = puesto;
    await doc.save();
    res.json(doc.toObject());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const r = await Empleado.deleteOne({ id: Number(req.params.id) });
    if (r.deletedCount === 0) return res.status(404).json({ error: 'Empleado no encontrado' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
