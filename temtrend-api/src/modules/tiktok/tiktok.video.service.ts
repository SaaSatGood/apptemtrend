import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, open, rm, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { env } from '../../config/env.js';
import { TikTokUploadError, TikTokVideoValidationError } from './tiktok.errors.js';
import type { IncomingVideo, TikTokCreatorInfo, VideoProbe } from './tiktok.types.js';

const execFileAsync = promisify(execFile);
const ALLOWED: Record<string, string[]> = {
  'video/mp4': ['.mp4'],
  'video/quicktime': ['.mov'],
  'video/webm': ['.webm'],
};
const CODECS = new Set(['h264', 'hevc', 'vp8', 'vp9']);

function frameRate(value: string | undefined) {
  if (!value) return 0;
  const [numerator = 0, denominator = 1] = value.split('/').map(Number);
  return denominator ? numerator / denominator : 0;
}

export async function probeVideo(filePath: string): Promise<VideoProbe> {
  try {
    const { stdout } = await execFileAsync(env.FFPROBE_PATH, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width,height,r_frame_rate:format=duration', '-of', 'json', filePath], { timeout: 15_000, maxBuffer: 1024 * 1024 });
    const result = JSON.parse(stdout);
    const stream = result.streams?.[0];
    return { durationSec: Number(result.format?.duration || 0), width: Number(stream?.width || 0), height: Number(stream?.height || 0), fps: frameRate(stream?.r_frame_rate), codec: String(stream?.codec_name || '') };
  } catch {
    throw new TikTokVideoValidationError('Não foi possível validar o vídeo. Verifique se o arquivo está íntegro.');
  }
}

async function validateSignature(filePath: string, mimeType: string) {
  const file = await open(filePath, 'r');
  try {
    const header = Buffer.alloc(16);
    await file.read(header, 0, 16, 0);
    const isIsoMedia = header.subarray(4, 8).toString('ascii') === 'ftyp';
    const isWebm = header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    if ((mimeType === 'video/webm' && !isWebm) || (mimeType !== 'video/webm' && !isIsoMedia)) throw new TikTokVideoValidationError();
  } finally {
    await file.close();
  }
}

export function validateProbe(probe: VideoProbe, creatorInfo: TikTokCreatorInfo) {
  const maxDuration = Math.min(600, creatorInfo.max_video_post_duration_sec || 600);
  if (!CODECS.has(probe.codec) || probe.fps < 23 || probe.fps > 60 || probe.width < 360 || probe.height < 360 || probe.width > 4096 || probe.height > 4096 || probe.durationSec <= 0 || probe.durationSec > maxDuration) {
    throw new TikTokVideoValidationError();
  }
}

export async function writeAndValidateIncomingVideo(video: IncomingVideo, creatorInfo: TikTokCreatorInfo) {
  const extension = path.extname(video.filename).toLowerCase();
  if (!ALLOWED[video.mimeType]?.includes(extension)) throw new TikTokVideoValidationError('Envie um vídeo MP4, MOV ou WebM.');
  const directory = path.join(os.tmpdir(), 'temtrend-videos');
  await mkdir(directory, { recursive: true });
  const tempPath = path.join(directory, `${crypto.randomUUID()}${extension}`);
  let size = 0;
  const limiter = new Transform({
    transform(chunk, _encoding, callback) {
      size += chunk.length;
      if (size > env.TIKTOK_MAX_VIDEO_SIZE) callback(new TikTokVideoValidationError('O vídeo excede o tamanho máximo permitido.'));
      else callback(null, chunk);
    },
  });
  try {
    await pipeline(video.stream, limiter, createWriteStream(tempPath, { flags: 'wx' }));
    const details = await stat(tempPath);
    if (!details.size) throw new TikTokVideoValidationError();
    await validateSignature(tempPath, video.mimeType);
    const probe = await probeVideo(tempPath);
    validateProbe(probe, creatorInfo);
    return { tempPath, extension, size: details.size, probe };
  } catch (error) {
    await rm(tempPath, { force: true });
    throw error;
  }
}

export async function uploadToPrivateStorage(filePath: string, objectPath: string, mimeType: string, fileSize: number) {
  const encodedPath = objectPath.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(`${env.SUPABASE_URL}/storage/v1/object/creator-videos/${encodedPath}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, apikey: env.SUPABASE_SERVICE_ROLE_KEY, 'content-type': mimeType, 'content-length': String(fileSize), 'x-upsert': 'false' },
    body: Readable.toWeb(createReadStream(filePath)),
    duplex: 'half',
  } as any);
  if (!response.ok) throw new TikTokUploadError();
}

export async function downloadSignedVideo(signedUrl: string, extension: string) {
  const directory = path.join(os.tmpdir(), 'temtrend-videos');
  await mkdir(directory, { recursive: true });
  const tempPath = path.join(directory, `${crypto.randomUUID()}${extension}`);
  const response = await fetch(signedUrl, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok || !response.body) throw new TikTokUploadError();
  await pipeline(Readable.fromWeb(response.body as any), createWriteStream(tempPath, { flags: 'wx' }));
  return tempPath;
}

