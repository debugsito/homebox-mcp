import { z } from 'zod';
export declare const healthResponseSchema: z.ZodObject<{
    status: z.ZodLiteral<"ok">;
}, "strip", z.ZodTypeAny, {
    status: "ok";
}, {
    status: "ok";
}>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
//# sourceMappingURL=health.d.ts.map