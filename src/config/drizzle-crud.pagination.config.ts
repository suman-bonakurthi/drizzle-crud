import { registerAs } from "@nestjs/config";
import type { PaginationConfig } from "../base.types"; // Assuming this interface is moved/defined in types

/**
 * --- PACKAGE-WIDE DEFAULTS ---
 * These constants serve as the fallback values if environment variables are not set.
 */
export const PAGINATION_DEFAULTS: PaginationConfig = {
	limit: 10,
	offset: 0,
};

/**
 * The key used to register and retrieve the pagination configuration in the NestJS ConfigService.
 * Consumers must use this key (e.g., configService.get('drizzle-crud.pagination')) to access settings.
 */
export const CONFIG_NAMESPACE = "drizzle-crud.pagination";

/**
 * @description Provides the default pagination configuration for the Drizzle CRUD package.
 *
 * Consumers should import this default configuration and load it via their
 * ConfigModule.forRoot({ load: [DrizzleCrudPaginationConfig] }).
 * They can override these defaults by setting the corresponding environment
 * variables (e.g., DRIZZLE_CRUD_PAGINATION_LIMIT).
 */
export const DrizzleCrudPaginationConfig = registerAs(CONFIG_NAMESPACE, () => {
	// Use a package-specific prefix for environment variables to avoid conflicts
	const limitEnv = process.env.DRIZZLE_CRUD_PAGINATION_LIMIT;
	const offsetEnv = process.env.DRIZZLE_CRUD_PAGINATION_OFFSET;

	return {
		/**
		 * Default number of items to return in a paginated list.
		 * Overridable via the DRIZZLE_CRUD_PAGINATION_LIMIT environment variable, defaulting to 10.
		 */
		limit: parseInt(limitEnv || String(PAGINATION_DEFAULTS.limit), 10),

		/**
		 * Default starting point (skip) for a paginated list.
		 * Overridable via the DRIZZLE_CRUD_PAGINATION_OFFSET environment variable, defaulting to 0.
		 */
		offset: parseInt(offsetEnv || String(PAGINATION_DEFAULTS.offset), 10),
	} as PaginationConfig;
});
