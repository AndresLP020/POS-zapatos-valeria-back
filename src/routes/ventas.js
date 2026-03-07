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

// Editar ticket: modificar items (precio, cantidad), agregar o quitar productos. Ajusta inventario y recalcula total/ganancias.
router.put('/:id', async (req, res) => {
  try {
    const ventaId = Number(req.params.id);
    const venta = await Venta.findOne({ id: ventaId });
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });

    const { items: itemsBody } = req.body || {};
    const rawItems = Array.isArray(itemsBody) ? itemsBody : [];
    if (rawItems.length === 0) return res.status(400).json({ error: 'Debe enviar al menos un producto en items' });

    const itemsViejos = venta.items || [];
    const itemsNuevos = rawItems.map((it) => ({
      id: Number(it.id),
      nombre: String(it.nombre || '').trim() || 'Producto',
      precio: Number(it.precio) || 0,
      cantidad: Math.max(0, Number(it.cantidad) || 0),
      costo: it.costo != null ? Number(it.costo) : 0,
    })).filter((it) => it.cantidad > 0);

    if (itemsNuevos.length === 0) return res.status(400).json({ error: 'Debe haber al menos un ítem con cantidad mayor a 0' });

    // Obtener costo de productos que no lo traen (ej. recién agregados al ticket)
    for (const it of itemsNuevos) {
      if (it.costo == null || (it.costo === 0 && it.id)) {
        const prod = await Producto.findOne({ id: it.id }).lean();
        if (prod && prod.costo != null) it.costo = Number(prod.costo);
      }
    }

    // 1) Devolver al inventario lo que tenía la venta original
    for (const it of itemsViejos) {
      const cant = Number(it.cantidad) || 0;
      if (cant > 0 && it.id != null) {
        await Producto.findOneAndUpdate(
          { id: it.id },
          { $inc: { stock: cant } }
        );
      }
    }

    // 2) Descontar del inventario lo que tendrá la venta nueva
    for (const it of itemsNuevos) {
      if (it.cantidad > 0 && it.id != null) {
        const prod = await Producto.findOne({ id: it.id });
        if (prod) {
          const stockActual = Number(prod.stock) || 0;
          const nuevoStock = stockActual - it.cantidad;
          if (nuevoStock < 0) {
            // Revertir lo que ya devolvimos
            for (const prev of itemsViejos) {
              const c = Number(prev.cantidad) || 0;
              if (c > 0 && prev.id != null) {
                await Producto.findOneAndUpdate({ id: prev.id }, { $inc: { stock: -c } });
              }
            }
            return res.status(400).json({
              error: `No hay stock suficiente para "${it.nombre}". Disponible: ${stockActual}, solicitado: ${it.cantidad}`,
            });
          }
          await Producto.findOneAndUpdate(
            { id: it.id },
            { $inc: { stock: -it.cantidad } }
          );
        }
      }
    }

    const nuevoTotal = itemsNuevos.reduce((sum, it) => sum + it.precio * it.cantidad, 0);
    const pagado = Number(venta.pagado) ?? 0;
    const nuevoPendiente = Math.max(0, nuevoTotal - pagado);
    venta.items = itemsNuevos;
    venta.total = nuevoTotal;
    venta.pendiente = nuevoPendiente;
    venta.estado = nuevoPendiente <= 0 ? 'pagado' : 'pendiente';
    await venta.save();
    res.json(venta.toObject());
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
