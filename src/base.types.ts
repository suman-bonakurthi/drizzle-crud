import type { AnyColumn, Table } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { AnyPgTable } from "drizzle-orm/pg-core";
import type { PaginationQueryDto } from "./dto/pagination-query.dto"; // Assuming you'll make a generic version of this DTO

/**
 * Define the structure for a Drizzle schema object.
 * This is generic and must be passed in by the consumer.
 */
export type GenericDrizzleSchema = Record<string, AnyPgTable | Table>;

/**
 * Defines the Drizzle database connection type, generic over the consumer's schema.
 */
export type DrizzleDatabase<TSchema extends GenericDrizzleSchema> =
	NodePgDatabase<TSchema>;

/**
 * Base entity shape the service works with.
 */
export interface BaseEntity {
	id: number;
	createdAt: Date;
	updatedAt: Date;
	deletedAt: Date | null;
}

/**
 * Configuration options for relations, used by the Query Builder.
 */
export interface RelationOptions {
	tableName?: string;
	foreignKey?: string;
	columns?: Record<string, boolean>;
	searchableColumns?: readonly string[];
}

/**
 * Options passed to the Base Service constructor.
 */
export interface FindAllOptions<TTable extends AnyPgTable> {
	relations?: Record<string, RelationOptions>;
	selectedColumns?: (keyof TTable["_"]["columns"])[];
}

/**
 * Dependencies required by the Base Query Builder.
 */
export interface CrudQueryBuilderDependencies<
	TTable extends AnyPgTable,
	TFilterDto extends PaginationQueryDto,
	TSchema extends GenericDrizzleSchema,
> {
	db: DrizzleDatabase<TSchema>;
	table: TTable;
	schema: TSchema; // We now require the full schema object
	options?: FindAllOptions<TTable>;
	allowedSortColumns: readonly string[];
	allowedFilterColumns: readonly string[];
	configService: { get: (key: string, defaultValue: unknown) => unknown }; // Minimal ConfigService type
	filterQuery: TFilterDto;
}

/** Helper type to safely access id and deletedAt columns */
export type TableWithColumns<TTable extends AnyPgTable> = TTable &
	Record<string, AnyColumn>;

export interface PaginationConfig {
	limit: number;
	offset: number;
}
