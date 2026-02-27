import { Router } from 'express';
import { getNextId } from '../db.js';
import { Venta } from '../models/Venta.js';
import { Producto } from '../models/Producto.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const ventas = await Venta.find().sort({ id: -1 }).lean();
    res.json(ventas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { items, total, cliente, clienteId, pagado } = req.body;
    const totalVenta = Number(total) || 0;
    const pagadoVenta = Number(pagado) ?? totalVenta;
    const itemsConCosto = (items || []).map((it) => ({
      id: it.id,
      nombre: it.nombre,
      precio: Number(it.precio) || 0,
      cantidad: Number(it.cantidad) || 0,
      costo: it.costo != null ? Number(it.costo) : 0,
    }));
    const id = await getNextId(Venta);
    const venta = await Venta.create({
      id,
      fecha: new Date().toISOString(),
      items: itemsConCosto,
      total: totalVenta,
      pagado: pagadoVenta,
      pendiente: totalVenta - pagadoVenta,
      cliente: cliente || '',
      clienteId: clienteId ? Number(clienteId) : null,
      estado: pagadoVenta >= totalVenta ? 'pagado' : 'pendiente',
    });
    // Descontar stock de cada producto en la base de datos
    for (const it of itemsConCosto) {
      await Producto.findOneAndUpdate(
        { id: it.id },
        { $inc: { stock: -it.cantidad } }
      );
    }
    res.status(201).json(venta.toObject());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/abonar', async (req, res) => {
  try {
    const { monto } = req.body;
    const venta = await Venta.findOne({ id: Number(req.params.id) });
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
    const nuevoPagado = (venta.pagado || 0) + Number(monto);
    const nuevoPendiente = Math.max(0, venta.total - nuevoPagado);
    venta.pagado = nuevoPagado;
    venta.pendiente = nuevoPendiente;
    venta.estado = nuevoPendiente <= 0 ? 'pagado' : 'pendiente';
    await venta.save();
    res.json(venta.toObject());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
