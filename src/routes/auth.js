import { Router } from 'express';

const router = Router();

// Credenciales de acceso al sistema (página de login). En producción definir en Render:
// LOGIN_USER y LOGIN_PASSWORD. Por defecto: admin / admin123
const LOGIN_USER = (process.env.LOGIN_USER || 'admin').trim().toLowerCase();
const LOGIN_PASSWORD = (process.env.LOGIN_PASSWORD || 'admin123').trim();

// Contraseña de administrador (modo admin en dashboard). En producción definir ADMIN_PASSWORD en .env
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'admin')).trim();

router.post('/login', (req, res) => {
  const { usuario, password } = req.body || {};
  const user = usuario != null ? String(usuario).trim().toLowerCase() : '';
  const pass = password != null ? String(password) : '';
  if (!user || !pass) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
  }
  if (user === LOGIN_USER && pass === LOGIN_PASSWORD) {
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
});

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
