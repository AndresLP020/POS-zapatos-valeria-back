import { Router } from 'express';
import { getNextId } from '../db.js';
import { Producto } from '../models/Producto.js';
import { generarSiguienteCodigoBarrasEAN13 } from '../lib/codigoBarras.js';

const router = Router();
const redondear2 = (n) => Math.round(Number(n) * 100) / 100;
const stockEntero = (n) => Math.max(0, Math.floor(Number(n) || 0));

router.get('/', async (req, res) => {
  try {
    const proveedorId = req.query.proveedorId != null ? Number(req.query.proveedorId) : null;
    const query = proveedorId != null ? { proveedorId } : {};
    const productos = await Producto.find(query).sort({ id: 1 }).lean();
    res.json(productos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/codigo/:codigo', async (req, res) => {
  try {
    const p = await Producto.findOne({ codigo: req.params.codigo }).lean();
    if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(p);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Siguiente código EAN-13 único (vista previa antes de guardar o regenerar en edición). */
router.get('/siguiente-codigo-barras', async (req, res) => {
  try {
    const exclude =
      req.query.excludeProductId != null && req.query.excludeProductId !== ''
        ? Number(req.query.excludeProductId)
        : null;
    const codigo = await generarSiguienteCodigoBarrasEAN13(Producto, getNextId, exclude);
    res.json({ codigo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const p = await Producto.findOne({ id: Number(req.params.id) }).lean();
    if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(p);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { nombre, codigo, categoria, precio, costo, stock, stockMinimo, estado, proveedorId } = req.body;
    const codigoTrim = codigo != null && String(codigo).trim() ? String(codigo).trim() : '';
    if (codigoTrim) {
      const duplicado = await Producto.findOne({ codigo: codigoTrim }).lean();
      if (duplicado) return res.status(409).json({ error: 'Ya existe un producto con ese código de barras' });
    }
    const id = await getNextId(Producto);
    const nuevo = await Producto.create({
      id,
      nombre,
      codigo: codigoTrim || String(id).padStart(10, '0'),
      categoria,
      precio: redondear2(precio) || 0,
      costo: redondear2(costo) || 0,
      stock: stockEntero(stock),
      stockBodega: 0,
      stockMinimo: stockMinimo != null ? stockEntero(stockMinimo) : 0,
      estado: estado || 'Activo',
      proveedorId: proveedorId != null ? Number(proveedorId) : undefined,
    });
    res.status(201).json(nuevo.toObject());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const pid = Number(req.params.id);
    const doc = await Producto.findOne({ id: pid });
    if (!doc) return res.status(404).json({ error: 'Producto no encontrado' });
    const { nombre, codigo, categoria, precio, costo, stock, stockMinimo, estado, proveedorId } = req.body;
    if (nombre != null) doc.nombre = nombre;
    if (codigo != null) {
      const c = String(codigo).trim();
      if (c) {
        const duplicado = await Producto.findOne({ codigo: c, id: { $ne: pid } }).lean();
        if (duplicado) return res.status(409).json({ error: 'Ya existe otro producto con ese código de barras' });
      }
      doc.codigo = c;
    }
    if (categoria != null) doc.categoria = categoria;
    if (precio != null) doc.precio = redondear2(precio);
    if (costo != null) doc.costo = redondear2(costo);
    if (stock != null) doc.stock = stockEntero(stock);
    if (stockMinimo != null) doc.stockMinimo = stockEntero(stockMinimo);
    if (estado != null) doc.estado = estado;
    if (proveedorId !== undefined) doc.proveedorId = proveedorId != null ? Number(proveedorId) : null;
    await doc.save();
    res.json(doc.toObject());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const r = await Producto.deleteOne({ id: Number(req.params.id) });
    if (r.deletedCount === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
