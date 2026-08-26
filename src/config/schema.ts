import { z } from "zod";
import { STAGE_ORDER } from "../stages/types.js";

const stageConfigEntrySchema = z.object({
  backend: z.string(),
});

export const configSchema = z.object({
  stages: z
    .partialRecord(z.enum(STAGE_ORDER), stageConfigEntrySchema)
    .optional(),
});

export type Config = z.infer<typeof configSchema>;
