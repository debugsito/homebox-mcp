import { z } from 'zod';
export const healthResponseSchema = z.object({
    status: z.literal('ok'),
});
//# sourceMappingURL=health.js.map