import { Router } from 'express';
import { getNextId } from '../db.js';
import { MovimientoLienzo } from '../models/MovimientoLienzo.js';
import { GastoAdmin } from '../models/GastoAdmin.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const movimientos = await MovimientoLienzo.find().sort({ fecha: -1, id: -1 }).lean();
    res.json(movimientos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { fecha, tipo, descripcion, monto } = req.body;
    if (!tipo || (tipo !== 'ingreso' && tipo !== 'gasto')) {
      return res.status(400).json({ error: 'tipo debe ser "ingreso" o "gasto"' });
    }
    const montoNum = Number(monto);
    if (Number.isNaN(montoNum) || montoNum <= 0) {
      return res.status(400).json({ error: 'monto debe ser mayor a 0' });
    }
    const id = await getNextId(MovimientoLienzo);
    const descripcionStr = descripcion?.trim() || '';
    // Guardar solo la fecha (YYYY-MM-DD) para evitar desfase de un día por zona horaria (ej. México UTC-6)
    const fechaStr = fecha
      ? String(fecha).trim().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    const doc = await MovimientoLienzo.create({
      id,
      fecha: fechaStr,
      tipo,
      descripcion: descripcionStr,
      monto: montoNum,
    });

    if (tipo === 'gasto') {
      // Registrar también en Gastos Admin para que se descuente de la ganancia neta en todos los apartados (Gastos Admin, Sueldos, Reportes).
      const gastoId = await getNextId(GastoAdmin);
      await GastoAdmin.create({
        id: gastoId,
        fecha: fechaStr,
        descripcion: descripcionStr ? `Lienzo Charro: ${descripcionStr}` : 'Lienzo Charro',
        categoria: 'Lienzo Charro',
        monto: montoNum,
      });
    }

    res.status(201).json(doc.toObject());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const r = await MovimientoLienzo.deleteOne({ id: Number(req.params.id) });
    if (r.deletedCount === 0) return res.status(404).json({ error: 'Movimiento no encontrado' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
