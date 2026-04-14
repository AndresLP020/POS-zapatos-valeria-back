import { Router } from 'express';
import { getNextId } from '../db.js';
import { Producto } from '../models/Producto.js';
import { MovimientoInventario } from '../models/MovimientoInventario.js';
import { registrarAuditoria } from '../lib/auditoria.js';

const router = Router();

const enteroPositivo = (n) => Math.max(0, Math.floor(Number(n) || 0));

function normalizarStocks(doc) {
  const total = enteroPositivo(doc.stock);
  const bodegaRaw = enteroPositivo(doc.stockBodega);
  const bodega = Math.min(total, bodegaRaw);
  const tienda = total - bodega;
  return { total, bodega, tienda };
}

router.get('/', async (_req, res) => {
  try {
    const productos = await Producto.find().sort({ nombre: 1, id: 1 }).lean();
    res.json(
      productos.map((p) => {
        const { total, bodega, tienda } = normalizarStocks(p);
        return {
          id: p.id,
          nombre: p.nombre,
          codigo: p.codigo || '',
          categoria: p.categoria || '',
          stockTotal: total,
          stockBodega: bodega,
          stockTienda: tienda,
        };
      })
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/movimientos', async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(300, Math.floor(Number(req.query.limit) || 80)));
    const list = await MovimientoInventario.find().sort({ id: -1 }).limit(limit).lean();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/solicitudes', async (req, res) => {
  try {
    const estado = String(req.query.estado || 'solicitado').toLowerCase();
    const limit = Math.max(1, Math.min(300, Math.floor(Number(req.query.limit) || 120)));
    const list = await MovimientoInventario.find({ estado }).sort({ id: -1 }).limit(limit).lean();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Tienda física solicita producto a bodega (no mueve stock aún). */
router.post('/solicitudes', async (req, res) => {
  try {
    const { productoId, cantidad, solicitadoPorId, solicitadoPor, recogidoPorId, recogidoPor } = req.body || {};
    const pid = Number(productoId);
    const qty = enteroPositivo(cantidad);
    if (!pid || qty <= 0) {
      return res.status(400).json({ error: 'productoId y cantidad (> 0) son requeridos' });
    }
    if (!String(solicitadoPor || '').trim() || !String(recogidoPor || '').trim()) {
      return res.status(400).json({ error: 'Debes indicar quién solicita en tienda y quién recogerá en bodega' });
    }
    const producto = await Producto.findOne({ id: pid }).lean();
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });

    const id = await getNextId(MovimientoInventario);
    const mov = await MovimientoInventario.create({
      id,
      fecha: new Date().toISOString(),
      productoId: pid,
      productoNombre: producto.nombre || `Producto #${pid}`,
      origen: 'bodega',
      destino: 'tienda',
      cantidad: qty,
      estado: 'solicitado',
      solicitadoPorId: solicitadoPorId != null ? Number(solicitadoPorId) : undefined,
      solicitadoPor: String(solicitadoPor).trim(),
      recogidoPorId: recogidoPorId != null ? Number(recogidoPorId) : undefined,
      recogidoPor: String(recogidoPor).trim(),
    });

    await registrarAuditoria({
      tipo: 'inventario_solicitud',
      modulo: 'inventario',
      descripcion: `Solicitud de tienda a bodega: ${mov.productoNombre} x${mov.cantidad}`,
      usuarioId: mov.solicitadoPorId,
      usuarioNombre: mov.solicitadoPor,
      metadata: {
        movimientoId: mov.id,
        productoId: mov.productoId,
        productoNombre: mov.productoNombre,
        cantidad: mov.cantidad,
        recogidoPor: mov.recogidoPor,
      },
    });

    res.status(201).json(mov.toObject());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Bodega autoriza salida de solicitud pendiente y se mueve stock bodega->tienda. */
router.post('/solicitudes/:id/autorizar', async (req, res) => {
  try {
    const movId = Number(req.params.id);
    const { autorizadoPorId, autorizadoPor, actorRole } = req.body || {};
    const role = String(actorRole || '').toLowerCase();
    if (!['bodega', 'admin'].includes(role)) {
      return res.status(403).json({ error: 'Solo un usuario con rol bodega (o admin) puede autorizar salidas' });
    }
    if (!String(autorizadoPor || '').trim()) {
      return res.status(400).json({ error: 'Debes indicar quién autoriza la salida en bodega' });
    }
    const mov = await MovimientoInventario.findOne({ id: movId });
    if (!mov) return res.status(404).json({ error: 'Solicitud no encontrada' });
    if (mov.estado !== 'solicitado') return res.status(400).json({ error: 'La solicitud ya fue autorizada' });

    const producto = await Producto.findOne({ id: mov.productoId });
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });

    const { total, bodega } = normalizarStocks(producto);
    const qty = enteroPositivo(mov.cantidad);
    if (qty > bodega) {
      return res.status(400).json({ error: `No hay suficiente en bodega. Disponible: ${bodega}` });
    }

    producto.stock = total;
    producto.stockBodega = bodega - qty;
    await producto.save();

    mov.estado = 'autorizado';
    mov.autorizadoPorId = autorizadoPorId != null ? Number(autorizadoPorId) : undefined;
    mov.autorizadoPor = String(autorizadoPor).trim();
    mov.fecha = new Date().toISOString();
    await mov.save();

    await registrarAuditoria({
      tipo: 'inventario_transferencia',
      modulo: 'inventario',
      descripcion: `Salida autorizada de bodega: ${mov.productoNombre} x${mov.cantidad}`,
      usuarioId: mov.autorizadoPorId,
      usuarioNombre: mov.autorizadoPor,
      metadata: {
        movimientoId: mov.id,
        productoId: mov.productoId,
        productoNombre: mov.productoNombre,
        cantidad: mov.cantidad,
        solicitadoPor: mov.solicitadoPor,
        autorizadoPor: mov.autorizadoPor,
        recogidoPor: mov.recogidoPor,
      },
    });

    res.json({
      ok: true,
      movimiento: mov.toObject(),
      producto: {
        id: producto.id,
        nombre: producto.nombre,
        stockTotal: producto.stock,
        stockBodega: producto.stockBodega,
        stockTienda: producto.stock - producto.stockBodega,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Transferencia directa (flujo genérico, útil para tienda->bodega).
 * Para bodega->tienda se recomienda usar solicitud + autorización.
 */
router.post('/transferir', async (req, res) => {
  try {
    const {
      productoId,
      cantidad,
      origen,
      destino,
      solicitadoPorId,
      solicitadoPor,
      autorizadoPorId,
      autorizadoPor,
      recogidoPorId,
      recogidoPor,
      actorRole,
    } = req.body || {};
    const pid = Number(productoId);
    const qty = enteroPositivo(cantidad);
    const o = String(origen || '').toLowerCase();
    const d = String(destino || '').toLowerCase();
    if (!pid || qty <= 0) return res.status(400).json({ error: 'productoId y cantidad (> 0) son requeridos' });
    if (!['bodega', 'tienda'].includes(o) || !['bodega', 'tienda'].includes(d) || o === d) {
      return res.status(400).json({ error: 'origen y destino deben ser "bodega" y "tienda" en sentidos opuestos' });
    }
    const role = String(actorRole || '').toLowerCase();
    if (d === 'bodega' && !['bodega', 'admin'].includes(role)) {
      return res.status(403).json({ error: 'Solo un usuario con rol bodega (o admin) puede recibir entradas en bodega' });
    }
    const producto = await Producto.findOne({ id: pid });
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    const { total, bodega, tienda } = normalizarStocks(producto);
    let nuevoBodega = bodega;
    if (o === 'bodega') {
      if (qty > bodega) return res.status(400).json({ error: `No hay suficiente en bodega. Disponible: ${bodega}` });
      nuevoBodega = bodega - qty;
    } else {
      if (qty > tienda) return res.status(400).json({ error: `No hay suficiente en tienda. Disponible: ${tienda}` });
      nuevoBodega = bodega + qty;
    }
    producto.stock = total;
    producto.stockBodega = nuevoBodega;
    await producto.save();

    const id = await getNextId(MovimientoInventario);
    const mov = await MovimientoInventario.create({
      id,
      fecha: new Date().toISOString(),
      productoId: producto.id,
      productoNombre: producto.nombre || `Producto #${producto.id}`,
      origen: o,
      destino: d,
      cantidad: qty,
      estado: 'autorizado',
      solicitadoPorId: solicitadoPorId != null ? Number(solicitadoPorId) : undefined,
      solicitadoPor: solicitadoPor ? String(solicitadoPor).trim() : 'Sistema',
      autorizadoPorId: autorizadoPorId != null ? Number(autorizadoPorId) : undefined,
      autorizadoPor: autorizadoPor ? String(autorizadoPor).trim() : 'Sistema',
      recogidoPorId: recogidoPorId != null ? Number(recogidoPorId) : undefined,
      recogidoPor: recogidoPor ? String(recogidoPor).trim() : '',
    });

    res.json({ ok: true, movimiento: mov.toObject() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
