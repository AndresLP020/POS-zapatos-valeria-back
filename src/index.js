import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import { conectarMongo } from './db.js';
import productosRouter from './routes/productos.js';
import ventasRouter from './routes/ventas.js';
import categoriasRouter from './routes/categorias.js';
import clientesRouter from './routes/clientes.js';
import proveedoresRouter from './routes/proveedores.js';
import deudasRouter from './routes/deudas.js';
import gastosAdminRouter from './routes/gastosAdmin.js';
import empleadosRouter from './routes/empleados.js';
import nominasRouter from './routes/nominas.js';
import adelantosRouter from './routes/adelantos.js';
import devolucionesRouter from './routes/devoluciones.js';
import usuariosRouter from './routes/usuarios.js';
import authRouter from './routes/auth.js';
import cuentasProveedoresRouter from './routes/cuentasProveedores.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.FRONT_URL || 'http://localhost:3000' }));
app.use(express.json());

app.get('/api/health', (_, res) => res.json({ ok: true, message: 'POS API' }));

app.use('/api/productos', productosRouter);
app.use('/api/ventas', ventasRouter);
app.use('/api/categorias', categoriasRouter);
app.use('/api/clientes', clientesRouter);
app.use('/api/proveedores', proveedoresRouter);
app.use('/api/cuentas-proveedores', cuentasProveedoresRouter);
app.use('/api/deudas', deudasRouter);
app.use('/api/gastos-admin', gastosAdminRouter);
app.use('/api/empleados', empleadosRouter);
app.use('/api/nominas', nominasRouter);
app.use('/api/adelantos', adelantosRouter);
app.use('/api/devoluciones', devolucionesRouter);
app.use('/api/usuarios', usuariosRouter);
app.use('/api/auth', authRouter);

conectarMongo()
  .then(() => {
    app.listen(PORT, () => {
      console.log('Servidor POS en http://localhost:' + PORT);
    });
  })
  .catch((err) => {
    console.error('No se pudo iniciar:', err);
    process.exit(1);
  });
