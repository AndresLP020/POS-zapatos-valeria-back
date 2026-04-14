/** Dígito verificador EAN-13 (12 primeros dígitos → 1 dígito). */
export function ean13CheckDigit(digits12) {
  if (!digits12 || digits12.length !== 12 || !/^\d{12}$/.test(digits12)) {
    throw new Error('Se requieren exactamente 12 dígitos para EAN-13');
  }
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(digits12[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return String((10 - (sum % 10)) % 10);
}

/**
 * Genera un código EAN-13 único (prefijo interno 200 + id base de 9 dígitos + verificador).
 * Si ya existe, incrementa el id base hasta encontrar hueco.
 */
export async function generarSiguienteCodigoBarrasEAN13(Producto, getNextId, excludeProductId = null) {
  let n = await getNextId(Producto);
  for (let k = 0; k < 10000; k++) {
    const base12 = `200${String(n).padStart(9, '0')}`;
    if (base12.length !== 12) {
      throw new Error('Límite de IDs para códigos EAN-13 alcanzado');
    }
    const codigo = base12 + ean13CheckDigit(base12);
    const query =
      excludeProductId != null
        ? { codigo, id: { $ne: Number(excludeProductId) } }
        : { codigo };
    const exists = await Producto.findOne(query).lean();
    if (!exists) return codigo;
    n += 1;
  }
  throw new Error('No se pudo generar un código de barras único');
}
