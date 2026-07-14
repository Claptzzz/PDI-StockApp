import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: ReturnType<typeof createClient>;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    const url = config.getOrThrow<string>('SUPABASE_URL');
    const serviceRoleKey = config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');
    this.bucket = config.getOrThrow<string>('SUPABASE_BUCKET');
    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  /**
   * Sube la foto de un préstamo al bucket privado y devuelve el PATH (no URL pública).
   * Valida el mimetype; si no está permitido → 400.
   */
  async uploadLoanPhoto(
    fileBuffer: Buffer,
    mimetype: string,
    originalName: string,
  ): Promise<string> {
    const ext = ALLOWED_MIME[mimetype];
    if (!ext) {
      throw new BadRequestException(
        `Tipo de imagen no permitido (${mimetype}). Usa JPEG, PNG o WebP`,
      );
    }

    const path = `loans/${randomUUID()}.${ext}`;
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(path, fileBuffer, { contentType: mimetype, upsert: false });

    if (error) {
      this.logger.error(`Fallo al subir la foto (${originalName}): ${error.message}`);
      throw new InternalServerErrorException('No se pudo subir la foto del préstamo');
    }

    this.logger.debug(`Foto subida a ${path} (original: ${originalName})`);
    return path;
  }

  /** Genera una URL firmada temporal para un objeto privado. Null si falla. */
  async getSignedUrl(path: string, expiresInSeconds = 3600): Promise<string | null> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(path, expiresInSeconds);

    if (error || !data) {
      this.logger.warn(`No se pudo firmar la URL de ${path}: ${error?.message ?? 'desconocido'}`);
      return null;
    }
    return data.signedUrl;
  }

  /** Borra el objeto del bucket (para rollback o al eliminar el préstamo). */
  async deleteLoanPhoto(path: string): Promise<void> {
    const { error } = await this.client.storage.from(this.bucket).remove([path]);
    if (error) {
      this.logger.warn(`No se pudo borrar la foto ${path}: ${error.message}`);
    }
  }
}
