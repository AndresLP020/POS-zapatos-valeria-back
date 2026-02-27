import { Router } from 'express';

const router = Router();

// Contraseña de administrador. En producción definir ADMIN_PASSWORD en .env
// Por defecto en desarrollo es "admin" si no se define ADMIN_PASSWORD.
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'admin')).trim();

router.post('/verify-admin', (req, res) => {
  const { password } = req.body || {};
  const provided = password != null ? String(password).trim() : '';
  if (!ADMIN_PASSWORD) {
    return res.status(503).json({ error: 'Contraseña de administrador no configurada (ADMIN_PASSWORD)' });
  }
  if (provided === ADMIN_PASSWORD) {
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: 'Contraseña incorrecta' });
});

export default router;
