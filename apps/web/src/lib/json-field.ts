import { Prisma } from "@prisma/client";
import { z } from "zod";

export function optionalJsonString(message: string) {
  return z
    .string()
    .optional()
    .transform((value, context): Prisma.InputJsonValue | undefined => {
      if (!value) return undefined;
      try {
        return JSON.parse(value) as Prisma.InputJsonValue;
      } catch {
        context.addIssue({ code: "custom", message });
        return z.NEVER;
      }
    });
}
