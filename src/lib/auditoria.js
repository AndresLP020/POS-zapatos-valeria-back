import { getNextId } from '../db.js';
import { Auditoria } from '../models/Auditoria.js';

export async function registrarAuditoria({
  tipo,
  modulo,
  descripcion,
  usuarioId,
  usuarioNombre,
  metadata,
}) {
  try {
    const id = await getNextId(Auditoria);
    await Auditoria.create({
      id,
      fecha: new Date().toISOString(),
      tipo: String(tipo || 'evento'),
      modulo: String(modulo || 'sistema'),
      descripcion: String(descripcion || 'Evento del sistema'),
      usuarioId: usuarioId != null ? Number(usuarioId) : undefined,
      usuarioNombre: usuarioNombre ? String(usuarioNombre) : undefined,
      metadata: metadata ?? undefined,
    });
  } catch (err) {
    console.error('No se pudo registrar auditoría:', err.message);
  }
}
