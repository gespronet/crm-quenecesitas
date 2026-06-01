import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vkhbkdibihwmwyshrofx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZraGJrZGliaWh3bXd5c2hyb2Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NzgyMDQsImV4cCI6MjA4NzI1NDIwNH0.UsFIv4kM3jbzTsR_xMWwWr5bj7F7ZiWdP6xpPOATRNw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Comprime un File PDF usando pdf-lib si supera 1MB.
 * Devuelve un File comprimido (o el original si falla o no aplica).
 */
export async function compressFileIfPdf(file) {
  if (!file || file.type !== 'application/pdf' || file.size <= 1_048_576) return file;
  try {
    const { PDFDocument } = await import('pdf-lib');
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    const compressed = await pdfDoc.save({ useObjectStreams: true });
    return new File([compressed], file.name, { type: 'application/pdf' });
  } catch (e) {
    console.warn('PDF compression failed, using original:', e.message);
    return file;
  }
}

/**
 * Limpia un nombre de archivo para uso seguro en Supabase Storage.
 * Elimina acentos, espacios y caracteres especiales.
 */
export function sanitizeFileName(name) {
  return name
    .normalize('NFD')                    // descompone acentos (á → a + ́)
    .replace(/[\u0300-\u036f]/g, '')     // elimina marcas de acento
    .toLowerCase()
    .replace(/\s+/g, '_')               // espacios → guiones bajos
    .replace(/[^a-z0-9._-]/g, '')      // elimina todo lo que no sea alfanum., punto, guion, _
    .replace(/-{2,}/g, '-')            // colapsa guiones dobles
    .replace(/_{2,}/g, '_');           // colapsa guiones bajos dobles
}
