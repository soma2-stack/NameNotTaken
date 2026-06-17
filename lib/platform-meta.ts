import { adapters } from "./platforms";

export type PlatformMeta = { name: string; tier: "A" | "B" };

export const PLATFORM_META: PlatformMeta[] = adapters.map(({ name, tier }) => ({
  name,
  tier,
}));
