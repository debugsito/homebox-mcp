import { homeBoxService, HomeBoxService } from '../../homebox/homebox.service.js';
import { logger } from '../../../utils/logger.js';
import { z } from 'zod';
import type { Tool } from '../tool.types.js';

const MIME_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const;

/** HomeBox está configurado con HBOX_WEB_MAX_UPLOAD_SIZE=50 (MB). */
const MAX_BYTES = 50 * 1024 * 1024;

const attachPhotoInputSchema = z.object({
  itemId: z.string().min(1, 'Item ID is required'),
  imageBase64: z.string().min(1, 'Image data is required'),
  mimeType: z.enum(MIME_PERMITIDOS).default('image/jpeg'),
  filename: z.string().optional(),
  primary: z.boolean().optional().default(true),
});

export class AttachPhotoTool implements Tool {
  public name = 'attach_photo';
  public description =
    'Attach a photo to an existing inventory item. The image must be base64-encoded. ' +
    'When primary is true the photo becomes the item thumbnail.';
  public readOnly = false;
  public destructive = false;
  public inputSchema = attachPhotoInputSchema;

  private service: HomeBoxService;

  constructor(service: HomeBoxService = homeBoxService) {
    this.service = service;
  }

  async execute(input: unknown) {
    const parsed = attachPhotoInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(`Invalid input: ${parsed.error.message}`);
    }

    const { itemId, imageBase64, mimeType, filename, primary } = parsed.data;
    const file = decodificar(imageBase64);

    if (file.byteLength === 0) {
      throw new Error('La imagen viene vacía');
    }
    if (file.byteLength > MAX_BYTES) {
      throw new Error(
        `La imagen pesa ${Math.round(file.byteLength / 1024 / 1024)} MB y el límite son 50 MB`
      );
    }

    const nombre = filename ?? `foto.${mimeType.split('/')[1]}`;
    logger.debug({ tool: this.name, itemId, bytes: file.byteLength }, 'Executing attach_photo');

    const attachment = await this.service.uploadAttachment(itemId, {
      file,
      filename: nombre,
      mimeType,
      type: 'photo',
      primary,
      title: nombre,
    });

    return {
      attachmentId: attachment.id,
      itemId,
      primary: attachment.primary,
      bytes: file.byteLength,
    };
  }
}

/** Acepta base64 pelado o un data URI, que es como suelen llegar del cliente. */
function decodificar(raw: string): Uint8Array {
  const limpio = raw.replace(/^data:[^;]+;base64,/, '').trim();
  return new Uint8Array(Buffer.from(limpio, 'base64'));
}
