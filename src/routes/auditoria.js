import { Router } from 'express';
import { Auditoria } from '../models/Auditoria.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(500, Math.floor(Number(req.query.limit) || 200)));
    const modulo = req.query.modulo ? String(req.query.modulo) : null;
    const tipo = req.query.tipo ? String(req.query.tipo) : null;
    const query = {};
    if (modulo) query.modulo = modulo;
    if (tipo) query.tipo = tipo;
    const list = await Auditoria.find(query).sort({ id: -1 }).limit(limit).lean();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
