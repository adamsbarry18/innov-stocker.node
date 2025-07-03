import { SecurityLevel } from '@/modules/users/models/users.entity';

/**
 * Map of feature names to allowed action names.
 * Example: { user: ['read', 'update'], config: ['read'] }
 */
export type PermissionsInputMap = Record<string, string[]>;

/**
 * Effective and decoded authorisations for a user.
 * Combines base level and overrides, considering expiry.
 */
export interface DecodedAuthorisations {
  userId: number;
  level: number;
  expiresAt: Date | null;
  permissions: Record<
    string,
    {
      id: number;
      actions: string[];
    }
  >;
}

/**
 * Interface for the raw configuration of a flag.
 */
interface RawFlagConfig {
  value: number;
  inheritedFlags?: string[];
  level: SecurityLevel;
}

/**
 * Interface for the processed configuration of a flag.
 */
interface ProcessedFlag {
  value: number;
  combinedMask: number;
  level: SecurityLevel;
}

/**
 * The configuration for features.
 */
export const FEATURES_CONFIG = [
  {
    id: 1,
    name: 'user',
    flags: {
      read: { value: 1, level: SecurityLevel.READER },
      update: { value: 2, level: SecurityLevel.USER },
      create: { value: 4, inheritedFlags: ['update'], level: SecurityLevel.USER },
      delete: { value: 8, level: SecurityLevel.ADMIN },
      execute: { value: 16, level: SecurityLevel.USER },
      export: { value: 32, level: SecurityLevel.USER },
    } as Record<string, Partial<RawFlagConfig>>,
  },
  {
    id: 2,
    name: 'customer_group',
    flags: {
      read: { value: 1, level: SecurityLevel.READER },
      update: { value: 2, level: SecurityLevel.INTEGRATOR },
      create: { value: 4, inheritedFlags: ['update'], level: SecurityLevel.INTEGRATOR },
      delete: { value: 8, level: SecurityLevel.INTEGRATOR },
    } as Record<string, Partial<RawFlagConfig>>,
  },
  {
    id: 3,
    name: 'customer',
    flags: {
      read: { value: 1, level: SecurityLevel.READER },
      update: { value: 2, level: SecurityLevel.INTEGRATOR },
      create: { value: 4, inheritedFlags: ['update'], level: SecurityLevel.INTEGRATOR },
      delete: { value: 8, level: SecurityLevel.INTEGRATOR },
      export: { value: 16, level: SecurityLevel.INTEGRATOR },
    } as Record<string, Partial<RawFlagConfig>>,
  },
  {
    id: 4,
    name: 'supplier',
    flags: {
      read: { value: 1, level: SecurityLevel.READER },
      update: { value: 2, level: SecurityLevel.INTEGRATOR },
      create: { value: 4, inheritedFlags: ['update'], level: SecurityLevel.INTEGRATOR },
      delete: { value: 8, level: SecurityLevel.INTEGRATOR },
      export: { value: 16, level: SecurityLevel.INTEGRATOR },
    } as Record<string, Partial<RawFlagConfig>>,
  },
  {
    id: 5,
    name: 'product',
    flags: {
      read: { value: 1, level: SecurityLevel.READER },
      update: { value: 2, level: SecurityLevel.INTEGRATOR },
      create: { value: 4, inheritedFlags: ['update'], level: SecurityLevel.INTEGRATOR },
      delete: { value: 8, level: SecurityLevel.INTEGRATOR },
      export: { value: 16, level: SecurityLevel.INTEGRATOR },
    } as Record<string, Partial<RawFlagConfig>>,
  },
  {
    id: 6,
    name: 'product_category',
    flags: {
      read: { value: 1, level: SecurityLevel.READER },
      update: { value: 2, level: SecurityLevel.INTEGRATOR },
      create: { value: 4, inheritedFlags: ['update'], level: SecurityLevel.INTEGRATOR },
      delete: { value: 8, level: SecurityLevel.INTEGRATOR },
    } as Record<string, Partial<RawFlagConfig>>,
  },
  {
    id: 7,
    name: 'stock_movement',
    flags: {
      read: { value: 1, level: SecurityLevel.READER },
      update: { value: 2, level: SecurityLevel.INTEGRATOR },
      create: { value: 4, inheritedFlags: ['update'], level: SecurityLevel.INTEGRATOR },
      execute: { value: 8, level: SecurityLevel.INTEGRATOR },
      export: { value: 16, level: SecurityLevel.INTEGRATOR },
    } as Record<string, Partial<RawFlagConfig>>,
  },
  {
    id: 8,
    name: 'warehouse',
    flags: {
      read: { value: 1, level: SecurityLevel.READER },
      update: { value: 2, level: SecurityLevel.INTEGRATOR },
      create: { value: 4, inheritedFlags: ['update'], level: SecurityLevel.INTEGRATOR },
      delete: { value: 8, level: SecurityLevel.INTEGRATOR },
    } as Record<string, Partial<RawFlagConfig>>,
  },
  {
    id: 9,
    name: 'shop',
    flags: {
      read: { value: 1, level: SecurityLevel.READER },
      update: { value: 2, level: SecurityLevel.INTEGRATOR },
      create: { value: 4, inheritedFlags: ['update'], level: SecurityLevel.INTEGRATOR },
      delete: { value: 8, level: SecurityLevel.INTEGRATOR },
    } as Record<string, Partial<RawFlagConfig>>,
  },
  {
    id: 10,
    name: 'purchase_order',
    flags: {
      read: { value: 1, level: SecurityLevel.READER },
      update: { value: 2, level: SecurityLevel.INTEGRATOR },
      create: { value: 4, inheritedFlags: ['update'], level: SecurityLevel.INTEGRATOR },
      execute: { value: 8, level: SecurityLevel.INTEGRATOR },
      export: { value: 16, level: SecurityLevel.INTEGRATOR },
    } as Record<string, Partial<RawFlagConfig>>,
  },
  {
    id: 11,
    name: 'purchase_reception',
    flags: {
      read: { value: 1, level: SecurityLevel.READER },
      update: { value: 2, level: SecurityLevel.INTEGRATOR },
      create: { value: 4, inheritedFlags: ['update'], level: SecurityLevel.INTEGRATOR },
      execute: { value: 8, level: SecurityLevel.INTEGRATOR },
      export: { value: 16, level: SecurityLevel.INTEGRATOR },
    } as Record<string, Partial<RawFlagConfig>>,
  },
  {
    id: 12,
    name: 'sales_order',
    flags: {
      read: { value: 1, level: SecurityLevel.READER },
      update: { value: 2, level: SecurityLevel.INTEGRATOR },
      create: { value: 4, inheritedFlags: ['update'], level: SecurityLevel.INTEGRATOR },
      delete: { value: 16, level: SecurityLevel.INTEGRATOR },
      execute: { value: 32, level: SecurityLevel.USER },
      export: { value: 64, level: SecurityLevel.INTEGRATOR },
    } as Record<string, Partial<RawFlagConfig>>,
  },
  {
    id: 13,
    name: 'customer_invoice',
    flags: {
      read: { value: 1, level: SecurityLevel.READER },
      update: { value: 2, level: SecurityLevel.INTEGRATOR },
      create: { value: 4, inheritedFlags: ['update'], level: SecurityLevel.INTEGRATOR },
      execute: { value: 8, level: SecurityLevel.INTEGRATOR },
      export: { value: 16, level: SecurityLevel.INTEGRATOR },
    } as Record<string, Partial<RawFlagConfig>>,
  },
  {
    id: 14,
    name: 'payment',
    flags: {
      read: { value: 1, level: SecurityLevel.READER },
      update: { value: 2, level: SecurityLevel.INTEGRATOR },
      create: { value: 4, inheritedFlags: ['update'], level: SecurityLevel.INTEGRATOR },
      execute: { value: 8, level: SecurityLevel.INTEGRATOR },
      export: { value: 16, level: SecurityLevel.INTEGRATOR },
    } as Record<string, Partial<RawFlagConfig>>,
  },
  {
    id: 15,
    name: 'cash_register',
    flags: {
      read: { value: 1, level: SecurityLevel.READER },
      update: { value: 2, level: SecurityLevel.INTEGRATOR },
      create: { value: 4, inheritedFlags: ['update'], level: SecurityLevel.INTEGRATOR },
      delete: { value: 8, level: SecurityLevel.INTEGRATOR },
    } as Record<string, Partial<RawFlagConfig>>,
  },
  {
    id: 16,
    name: 'cash_register_session',
    flags: {
      read: { value: 1, level: SecurityLevel.READER },
      create: { value: 4, level: SecurityLevel.INTEGRATOR },
      execute: { value: 8, level: SecurityLevel.INTEGRATOR },
    } as Record<string, Partial<RawFlagConfig>>,
  },
  {
    id: 17,
    name: 'cash_register_transaction',
    flags: {
      read: { value: 1, level: SecurityLevel.READER },
      create: { value: 4, level: SecurityLevel.INTEGRATOR },
    } as Record<string, Partial<RawFlagConfig>>,
  },
  {
    id: 18,
    name: 'config',
    flags: {
      read: { value: 1, level: SecurityLevel.READER },
      update: { value: 2, level: SecurityLevel.INTEGRATOR },
      create: { value: 4, level: SecurityLevel.INTEGRATOR },
      delete: { value: 8, level: SecurityLevel.INTEGRATOR },
      execute: { value: 16, level: SecurityLevel.INTEGRATOR },
    } as Record<string, Partial<RawFlagConfig>>,
  },
  {
    id: 19,
    name: 'notification',
    flags: {
      read: { value: 1, level: SecurityLevel.INTEGRATOR },
      create: { value: 2, level: SecurityLevel.INTEGRATOR },
      update: { value: 4, level: SecurityLevel.INTEGRATOR },
      delete: { value: 8, level: SecurityLevel.INTEGRATOR },
    } as Record<string, Partial<RawFlagConfig>>,
  },
  {
    id: 20,
    name: 'user_activity_log',
    flags: {
      read: { value: 1, level: SecurityLevel.INTEGRATOR },
      export: { value: 16, level: SecurityLevel.INTEGRATOR },
    } as Record<string, Partial<RawFlagConfig>>,
  },
  {
    id: 21,
    name: 'import',
    flags: {
      read: { value: 1, level: SecurityLevel.INTEGRATOR },
      create: { value: 4, level: SecurityLevel.INTEGRATOR },
      execute: { value: 8, level: SecurityLevel.INTEGRATOR },
    } as Record<string, Partial<RawFlagConfig>>,
  },
  {
    id: 23,
    name: 'authorization',
    flags: {
      read: { value: 1, level: SecurityLevel.ADMIN },
      update: { value: 2, level: SecurityLevel.ADMIN },
      delete: { value: 4, level: SecurityLevel.ADMIN },
    } as Record<string, Partial<RawFlagConfig>>,
  },
  {
    id: 24,
    name: 'supplier_return',
    flags: {
      read: { value: 1, level: SecurityLevel.READER },
      update: { value: 2, level: SecurityLevel.INTEGRATOR },
      create: { value: 4, inheritedFlags: ['update'], level: SecurityLevel.INTEGRATOR },
      delete: { value: 8, level: SecurityLevel.INTEGRATOR },
      execute: { value: 16, level: SecurityLevel.INTEGRATOR },
    } as Record<string, Partial<RawFlagConfig>>,
  },
  {
    id: 25,
    name: 'supplier_invoice',
    flags: {
      read: { value: 1, level: SecurityLevel.READER },
      update: { value: 2, level: SecurityLevel.INTEGRATOR },
      create: { value: 4, inheritedFlags: ['update'], level: SecurityLevel.INTEGRATOR },
      delete: { value: 8, level: SecurityLevel.INTEGRATOR },
    } as Record<string, Partial<RawFlagConfig>>,
  },
  {
    id: 26,
    name: 'stock_transfer',
    flags: {
      read: { value: 1, level: SecurityLevel.READER },
      update: { value: 2, level: SecurityLevel.INTEGRATOR },
      create: { value: 4, inheritedFlags: ['update'], level: SecurityLevel.INTEGRATOR },
      delete: { value: 8, level: SecurityLevel.INTEGRATOR },
      execute: { value: 16, level: SecurityLevel.INTEGRATOR },
    } as Record<string, Partial<RawFlagConfig>>,
  },
  {
    id: 27,
    name: 'quote',
    flags: {
      read: { value: 1, level: SecurityLevel.READER },
      update: { value: 2, level: SecurityLevel.INTEGRATOR },
      create: { value: 4, inheritedFlags: ['update'], level: SecurityLevel.INTEGRATOR },
      delete: { value: 8, level: SecurityLevel.INTEGRATOR },
      execute: { value: 16, level: SecurityLevel.INTEGRATOR },
    } as Record<string, Partial<RawFlagConfig>>,
  },
];
/**
 * Quick access object for features by name.
 */
export const FEATURES_BY_NAME: { [key: string]: (typeof FEATURES_CONFIG)[0] } = {};
/**
 * Quick access object for features by ID.
 */
export const FEATURES_BY_ID: { [key: number]: (typeof FEATURES_CONFIG)[0] } = {};
FEATURES_CONFIG.forEach((f) => {
  FEATURES_BY_NAME[f.name] = f;
  FEATURES_BY_ID[f.id] = f;
});

// Map[featureId] -> { actionName: RawFlagConfig }
/**
 * Map of feature ID to raw flag configurations.
 */
export const featuresRawFlagsConfigMap = new Map<number, Record<string, RawFlagConfig>>();

// Map[featureId] -> { name: string, flags: { actionName: ProcessedFlag } }
/**
 * Map of feature ID to processed flag configurations.
 */
export const featuresProcessedFlagsMap = new Map<
  number,
  { name: string; flags: Record<string, ProcessedFlag> }
>();

// --- PROCESSING without `bitmask-flags` library ---
FEATURES_CONFIG.forEach((feature) => {
  const defaultFlags: Record<string, RawFlagConfig> = {
    read: { value: 1, inheritedFlags: [], level: SecurityLevel.READER },
    update: { value: 2, inheritedFlags: ['read'], level: SecurityLevel.USER },
    create: { value: 4, inheritedFlags: ['read', 'update'], level: SecurityLevel.USER },
    execute: { value: 8, inheritedFlags: [], level: SecurityLevel.USER },
  };

  const rawFlagsForFeature: Record<string, RawFlagConfig> = {};
  const allFlagNames = new Set([
    ...Object.keys(defaultFlags),
    ...(feature.flags ? Object.keys(feature.flags) : []),
  ]);

  allFlagNames.forEach((flagName) => {
    const specificConf = feature.flags?.[flagName] ?? {};
    const defaultConf = defaultFlags[flagName];
    if (defaultConf) {
      rawFlagsForFeature[flagName] = {
        value: specificConf.value ?? defaultConf.value,
        inheritedFlags: specificConf.inheritedFlags ?? defaultConf.inheritedFlags ?? [],
        level: specificConf.level ?? defaultConf.level,
      };
    } else if (specificConf.value !== undefined && specificConf.level !== undefined) {
      rawFlagsForFeature[flagName] = {
        value: specificConf.value,
        inheritedFlags: specificConf.inheritedFlags ?? [],
        level: specificConf.level,
      };
    }
  });

  // Store raw configuration
  featuresRawFlagsConfigMap.set(feature.id, rawFlagsForFeature);

  // Calculate combined masks (unchanged logic)
  const processedFlags: Record<string, ProcessedFlag> = {};
  for (const flagName of Object.keys(rawFlagsForFeature)) {
    processedFlags[flagName] = {
      value: rawFlagsForFeature[flagName].value,
      combinedMask: calculateCombinedMask(flagName, rawFlagsForFeature),
      level: rawFlagsForFeature[flagName].level,
    };
  }

  // Store processed configuration
  featuresProcessedFlagsMap.set(feature.id, {
    name: feature.name,
    flags: processedFlags,
  });
});

/**
 * Calculates the combined mask for a given flag.
 * @param flagName The name of the flag.
 * @param flags The flag configurations.
 * @returns The combined mask.
 */
function calculateCombinedMask(flagName: string, flags: Record<string, RawFlagConfig>): number {
  const visited = new Set<string>();
  const stack: string[] = [flagName];
  let mask = 0;
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) continue;
    if (!visited.has(current)) {
      visited.add(current);
      const flag = flags[current];
      if (flag) {
        mask |= flag.value;
        stack.push(...(flag.inheritedFlags ?? []));
      }
    }
  }
  return mask;
}

/**
 * Pads a string with a given padding.
 * @param value The string to pad.
 * @param padding The padding string.
 * @returns The padded string.
 */
export const paddingLeft = (value: string, padding: string): string => {
  return (padding + value).slice(-padding.length);
};
