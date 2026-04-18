import { Router } from 'express';
import { getNextId } from '../db.js';
import { Venta } from '../models/Venta.js';
import { Producto } from '../models/Producto.js';
import { Cliente } from '../models/Cliente.js';
import { registrarAuditoria } from '../lib/auditoria.js';

const router = Router();

/** Deuda de libreta / migración: no afecta inventario. Solo cliente registrado y monto pendiente. */
router.post('/deuda-migracion', async (req, res) => {
  try {
    const { clienteId, montoPendiente, descripcion, fecha, vendedorId, vendedorNombre } = req.body || {};
    const cid = Number(clienteId);
    if (!Number.isFinite(cid) || cid <= 0) {
      return res.status(400).json({ error: 'Debes seleccionar un cliente válido' });
    }
    const monto = Number(montoPendiente);
    if (!Number.isFinite(monto) || monto <= 0) {
      return res.status(400).json({ error: 'El monto pendiente debe ser mayor a 0' });
    }
    const cliente = await Cliente.findOne({ id: cid }).lean();
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });

    const texto = (descripcion && String(descripcion).trim()) || 'Deuda anterior (migración desde libreta)';
    let fechaIso;
    if (fecha) {
      const d = new Date(fecha);
      if (Number.isNaN(d.getTime())) return res.status(400).json({ error: 'Fecha no válida' });
      fechaIso = d.toISOString();
    } else {
      fechaIso = new Date().toISOString();
    }

    const id = await getNextId(Venta);
    const items = [
      {
        id: -1,
        nombre: texto,
        precio: monto,
        cantidad: 1,
        costo: 0,
      },
    ];
    const venta = await Venta.create({
      id,
      fecha: fechaIso,
      items,
      total: monto,
      pagado: 0,
      pendiente: monto,
      cliente: cliente.nombre || '',
      clienteId: cid,
      estado: 'pendiente',
      vendedorId: vendedorId != null ? Number(vendedorId) : undefined,
      vendedorNombre: vendedorNombre ? String(vendedorNombre) : 'Migración deudas',
      origen: 'migracion',
    });
    await registrarAuditoria({
      tipo: 'venta',
      modulo: 'ventas',
      descripcion: `Deuda migración #${venta.id} — ${texto} — ${cliente.nombre}`,
      usuarioId: venta.vendedorId,
      usuarioNombre: venta.vendedorNombre || undefined,
      metadata: { ventaId: venta.id, migracion: true, clienteId: cid, monto },
    });
    res.status(201).json(venta.toObject());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
    const { items, total, cliente, clienteId, pagado, vendedorId, vendedorNombre } = req.body;
    const totalVenta = Number(total) || 0;
    const pagadoVenta = Number.isFinite(Number(pagado)) ? Number(pagado) : totalVenta;
    const pendienteVenta = Math.max(0, totalVenta - pagadoVenta);
    if (pendienteVenta > 0 && !clienteId) {
      return res.status(400).json({ error: 'Para registrar una venta a crédito debes seleccionar un cliente' });
    }
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
      pendiente: pendienteVenta,
      cliente: cliente || '',
      clienteId: clienteId ? Number(clienteId) : null,
      estado: pendienteVenta > 0 ? 'pendiente' : 'pagado',
      vendedorId: vendedorId != null ? Number(vendedorId) : undefined,
      vendedorNombre: vendedorNombre ? String(vendedorNombre) : '',
    });
    // Descontar stock de cada producto en la base de datos
    for (const it of itemsConCosto) {
      await Producto.findOneAndUpdate(
        { id: it.id },
        { $inc: { stock: -it.cantidad } }
      );
    }
    await registrarAuditoria({
      tipo: 'venta',
      modulo: 'ventas',
      descripcion: `Venta #${venta.id} registrada por ${venta.vendedorNombre || 'sin vendedor'}`,
      usuarioId: venta.vendedorId,
      usuarioNombre: venta.vendedorNombre || undefined,
      metadata: {
        ventaId: venta.id,
        total: venta.total,
        pagado: venta.pagado,
        pendiente: venta.pendiente,
        clienteId: venta.clienteId ?? null,
        cliente: venta.cliente || '',
      },
    });
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
