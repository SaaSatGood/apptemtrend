import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import path from 'node:path';
import crypto from 'node:crypto';
import { requireAdmin } from '../../plugins/auth.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import { UPLOAD, RATE_LIMITS } from '../../config/constants.js';
import { Errors } from '../../types/index.js';

function hasValidImageSignature(buffer: Buffer, mimetype: string): boolean {
  if (buffer.length < 4) return false;
  // JPEG: FF D8 FF
  if (mimetype === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  // PNG: 89 50 4E 47
  if (mimetype === 'image/png') return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  // GIF: GIF87a / GIF89a
  if (mimetype === 'image/gif') {
    const head = buffer.subarray(0, 6).toString('ascii');
    return head === 'GIF87a' || head === 'GIF89a';
  }
  // WEBP: RIFF....WEBP
  if (mimetype === 'image/webp') {
    return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  return false;
}
async function routes(app: FastifyInstance) {
  app.post('/admin/products/image', { preHandler: [requireAdmin], config: { rateLimit: RATE_LIMITS.AUTH_WRITE } }, async (request, reply) => {
    const file = await request.file();
    if (!file || !UPLOAD.ALLOWED_MIME_TYPES.includes(file.mimetype as never)) throw Errors.BAD_REQUEST('Envie uma imagem JPEG, PNG, WEBP ou GIF.');
    const ext = path.extname(file.filename).toLowerCase();
    if (!UPLOAD.ALLOWED_EXTENSIONS.includes(ext as never)) throw Errors.BAD_REQUEST('Extensão de imagem inválida.');
    const buffer = await file.toBuffer();
    if (buffer.length > UPLOAD.MAX_FILE_SIZE) throw Errors.BAD_REQUEST('A imagem deve ter no máximo 5MB.');
    if (!hasValidImageSignature(buffer, file.mimetype)) throw Errors.BAD_REQUEST('Arquivo inválido. Envie uma imagem real.');
    const objectPath = `${crypto.randomUUID()}${ext}`;
    const { error } = await supabaseAdmin.storage.from(UPLOAD.BUCKET).upload(objectPath, buffer, { contentType: file.mimetype, upsert: false });
    if (error) throw error;
    const { data } = supabaseAdmin.storage.from(UPLOAD.BUCKET).getPublicUrl(objectPath);
    return reply.status(201).send({ imagem_url: data.publicUrl });
  });
}
export default fp(routes, { name: 'storage-routes' });
