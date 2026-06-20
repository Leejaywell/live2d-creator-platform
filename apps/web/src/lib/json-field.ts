import { Prisma } from "@prisma/client";
import { z } from "zod";

// Live2D params are a flat { [paramId: string]: number } map. Cap the raw input
// and validate the parsed shape so we never JSON.parse-and-store an unbounded or
// arbitrarily-nested object that later ships to the browser.
const live2dParamsShape = z.record(z.string().max(100), z.number().finite());

export function optionalJsonString(message: string) {
  return z
    .string()
    .max(4000)
    .optional()
    .transform((value, context): Prisma.InputJsonValue | undefined => {
      if (!value) return undefined;
      let parsed: unknown;
      try {
        parsed = JSON.parse(value);
      } catch {
        context.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      const result = live2dParamsShape.safeParse(parsed);
      if (!result.success) {
        context.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return result.data as Prisma.InputJsonValue;
    });
}
