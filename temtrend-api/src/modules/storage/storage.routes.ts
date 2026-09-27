import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import path from 'node:path';
import crypto from 'node:crypto';
import { requireAdmin } from '../../plugins/auth.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import { UPLOAD } from '../../config/constants.js';
import { Errors } from '../../types/index.js';
async function routes(app: FastifyInstance) {
  app.post('/admin/products/image', { preHandler: [requireAdmin], config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    const file = await request.file();
    if (!file || !UPLOAD.ALLOWED_MIME_TYPES.includes(file.mimetype as never)) throw Errors.BAD_REQUEST('Envie uma imagem JPEG, PNG, WEBP ou GIF.');
    const ext = path.extname(file.filename).toLowerCase();
    if (!UPLOAD.ALLOWED_EXTENSIONS.includes(ext as never)) throw Errors.BAD_REQUEST('Extensão de imagem inválida.');
    const buffer = await file.toBuffer();
    if (buffer.length > UPLOAD.MAX_FILE_SIZE) throw Errors.BAD_REQUEST('A imagem deve ter no máximo 5MB.');
    const objectPath = `${crypto.randomUUID()}${ext}`;
    const { error } = await supabaseAdmin.storage.from(UPLOAD.BUCKET).upload(objectPath, buffer, { contentType: file.mimetype, upsert: false });
    if (error) throw error;
    const { data } = supabaseAdmin.storage.from(UPLOAD.BUCKET).getPublicUrl(objectPath);
    return reply.status(201).send({ imagem_url: data.publicUrl });
  });
}
export default fp(routes, { name: 'storage-routes' });
