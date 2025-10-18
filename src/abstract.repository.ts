import {
	ConflictException,
	ForbiddenException,
	InternalServerErrorException,
	NotFoundException,
} from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { and, AnyColumn, eq, inArray, isNull, ne, SQL } from "drizzle-orm";
import type { AnyPgTable } from "drizzle-orm/pg-core";
import { BaseQueryBuilder } from "./base.query.builder";
// Imports from the same package (your new library)
import type {
	BaseEntity,
	DrizzleDatabase,
	FindAllOptions,
	GenericDrizzleSchema,
	TableWithColumns,
} from "./base.types";

// The PaginationQueryDto type is assumed to be defined by the consumer or imported from a peer dependency.
type PaginationQueryDto = { limit?: number; offset?: number } & Record<
	string,
	unknown
>;

// Renamed to AbstractRepository
export abstract class AbstractRepository<
	TTable extends AnyPgTable,
	TEntity extends BaseEntity,
	TSchema extends GenericDrizzleSchema, // NEW: Generic Schema Type
	TCreateDto extends Record<string, unknown> = Record<string, unknown>,
	TUpdateDto extends Record<string, unknown> = Record<string, unknown>,
	TFilterDto extends PaginationQueryDto = PaginationQueryDto,
> {
	// We update the database type to be generic over TSchema
	constructor(
		protected readonly db: DrizzleDatabase<TSchema>,
		protected readonly table: TTable,
		protected readonly schema: TSchema, // NEW: Store the schema object
		protected readonly options?: FindAllOptions<TTable>,
	) {}

	// Abstract properties remain for subclass definition
	// NOTE: We change ConfigService to be a simplified type for portability
	protected abstract readonly configService: Pick<ConfigService, "get">;
	protected abstract readonly allowedSortColumns: readonly string[];
	protected abstract readonly allowedFilterColumns: readonly string[];

	// --- CRUD METHODS ---

	async findAll(filterQuery: TFilterDto): Promise<TEntity[]> {
		const queryBuilder = new BaseQueryBuilder<
			TTable,
			TEntity,
			TFilterDto,
			TSchema
		>({
			db: this.db,
			table: this.table,
			schema: this.schema, // Pass the schema object
			options: this.options,
			allowedSortColumns: this.allowedSortColumns,
			allowedFilterColumns: this.allowedFilterColumns,
			configService: this.configService,
			filterQuery,
		});

		return await queryBuilder.execute();
	}

	// NOTE: checkUniqueFields and other methods relying on tableCols and types
	// need their internal logic updated to use TSchema correctly, but the structure is sound.

	protected async safeExecute<T>(operation: () => Promise<T>): Promise<T> {
		// ... (implementation remains the same)
		try {
			return await operation();
		} catch (error: unknown) {
			if (error && typeof error === "object" && "code" in error) {
				const pgError = error as { code?: string; message?: string };
				if (pgError.code === "23505") {
					throw new ConflictException("Duplicate entry detected.");
				}
			}

			if (error instanceof NotFoundException) {
				throw error;
			}

			throw new InternalServerErrorException(
				`Database operation failed: ${(error as Error)?.message || "Unknown error"}`,
			);
		}
	}

	/**
	 * ✅ Utility method for unique constraints (needs refactoring to use TSchema)
	 */

	protected async checkUniqueFields<TDto extends Record<string, unknown>>(
		dto: TDto,
		uniqueFields: (keyof TDto & string)[],
		excludeId?: number,
	): Promise<void> {
		const tableCols = this.table as unknown as Record<string, AnyColumn>;

		for (const field of uniqueFields) {
			const value = dto[field];
			if (typeof value === "undefined" || !(field in tableCols)) continue;

			const column = tableCols[field] as AnyColumn;

			const whereCondition = (
				excludeId !== undefined
					? and(eq(column, value as unknown), ne(tableCols["id"], excludeId))
					: eq(column, value as unknown)
			) as SQL<unknown>;

			const existing = await this.db
				.select()
				.from(this.table as AnyPgTable)
				.where(whereCondition);

			if (existing.length > 0) {
				throw new ConflictException(
					`Entity with ${String(field)} "${value}" already exists.`,
				);
			}
		}
	}

	async create(
		dto: TCreateDto,
		options?: { uniqueFields?: (keyof TCreateDto & string)[] },
	): Promise<TEntity> {
		if (options?.uniqueFields?.length) {
			await this.checkUniqueFields(dto, options.uniqueFields);
		}

		const result = await this.db.insert(this.table).values(dto).returning();
		return result[0] as unknown as TEntity;
	}

	/** UPDATE — with optional uniqueness validation */
	async update(
		id: number,
		dto: TUpdateDto,
		options?: { uniqueFields?: (keyof TUpdateDto & string)[] },
	): Promise<TEntity> {
		const tableCols = this.table as unknown as TableWithColumns<TTable>;

		const existing = await this.db
			.select()
			.from(this.table as AnyPgTable)
			.where(eq(tableCols["id"], id));

		if (existing.length === 0) {
			throw new NotFoundException(`Entity with id ${id} not found`);
		}

		if (options?.uniqueFields?.length) {
			await this.checkUniqueFields(dto, options.uniqueFields, id);
		}
		const result = await this.db
			.update(this.table)
			.set({ ...dto, updatedAt: new Date() })
			.where(eq(tableCols["id"], id))
			.returning();

		return result[0] as unknown as TEntity;
	}

	async findOne(id: number): Promise<TEntity> {
		const tableCols = this.table as unknown as TableWithColumns<TTable>;

		// Build condition: id = ? AND deletedAt IS NULL (if deletedAt exists)
		const idCond = eq(tableCols["id"], id);
		const whereCond = tableCols["deletedAt"]
			? and(idCond, isNull(tableCols["deletedAt"]))
			: idCond;

		const result = await this.db
			.select()
			.from(this.table as AnyPgTable)
			.where(whereCond);

		if (!result.length) {
			throw new NotFoundException(`Entity with ID ${id} not found.`);
		}
		return result[0] as unknown as TEntity;
	}

	/** SOFT DELETE */
	async remove(id: number): Promise<TEntity> {
		const tableCols = this.table as unknown as TableWithColumns<TTable>;
		// Build the payload safely
		const payload: Record<string, unknown> = {
			updatedAt: new Date(),
		};

		if ("deletedAt" in tableCols) {
			payload["deletedAt"] = new Date();
		}

		const result = (await this.db
			.update(this.table)
			.set(payload)
			.where(eq(tableCols["id"], id))
			.returning()) as unknown as TEntity[];

		if (!result.length) {
			throw new NotFoundException(`Entity with ID ${id} not found.`);
		}

		return result[0];
	}

	async purge(id: number): Promise<TEntity> {
		const tableCols = this.table as unknown as TableWithColumns<TTable>;
		const table = this.table as AnyPgTable;

		// Fetch the entity first
		const result = await this.db
			.select()
			.from(table)
			.where(eq(tableCols["id"], id));

		const entity = result[0] as TEntity | undefined;

		if (!entity) {
			throw new NotFoundException(`Entity with ID ${id} not found.`);
		}

		// ✅ Direct, type-safe check
		if (!entity.deletedAt) {
			throw new ForbiddenException(
				`Entity with ID ${id} must be soft-deleted before it can be purged.`,
			);
		}

		// ✅ Safe Drizzle call
		await this.db.delete(table).where(eq(tableCols["id"], id));

		return entity;
	}

	/** RESTORE */
	async restore(id: number): Promise<TEntity> {
		const tableCols = this.table as unknown as TableWithColumns<TTable>;

		// 1️⃣ First, find the entity
		const entityResult = await this.db
			.select()
			.from(this.table as AnyPgTable)
			.where(eq(tableCols["id"], id));

		const entity = entityResult[0] as TEntity | undefined;

		if (!entity) {
			throw new NotFoundException(`Entity with ID ${id} not found.`);
		}

		// 2️⃣ Check if deletedAt exists in table definition
		if (!("deletedAt" in tableCols)) {
			throw new ForbiddenException(
				`Table ${this.table._.name} does not support soft delete.`,
			);
		}

		// 3️⃣ Ensure entity is actually soft deleted
		const deletedAt = (entity as unknown as { deletedAt?: Date | null })
			.deletedAt;
		if (!deletedAt) {
			throw new ForbiddenException(
				`Entity with ID ${id} is not soft-deleted and cannot be restored.`,
			);
		}

		// 4️⃣ Build update payload
		const payload: Record<string, unknown> = {
			updatedAt: new Date(),
			deletedAt: null,
		};

		// 5️⃣ Perform restore
		const result = (await this.db
			.update(this.table)
			.set(payload)
			.where(eq(tableCols["id"], id))
			.returning()) as unknown as TEntity[];

		if (!result.length) {
			throw new NotFoundException(
				`Entity with ID ${id} not found during restore.`,
			);
		}

		return result[0];
	}

	async bulkCreate(dtos: TCreateDto[]): Promise<TEntity[]> {
		return await this.db.transaction(async (tx) => {
			const result = await tx.insert(this.table).values(dtos).returning();
			return result as unknown as TEntity[];
		});
	}

	async bulkUpdate(
		records: { id: number; data: TUpdateDto }[],
	): Promise<TEntity[]> {
		const tableCols = this.table as unknown as TableWithColumns<TTable>;
		const updatedEntities: TEntity[] = [];

		await this.db.transaction(async (tx) => {
			for (const { id, data } of records) {
				// Type-safe ID column reference
				const idColumn = tableCols["id"];
				const result = (await tx
					.update(this.table)
					.set({ ...data, updatedAt: new Date() })
					.where(eq(idColumn, id))
					.returning()) as unknown as TEntity[];

				if (Array.isArray(result) && result.length > 0) {
					updatedEntities.push(result[0]);
				}
			}
		});

		return updatedEntities;
	}

	async bulkSoftDelete(ids: number[]): Promise<void> {
		const tableCols = this.table as unknown as TableWithColumns<TTable>;

		// Check that table has a deletedAt column before updating
		if (!("deletedAt" in tableCols)) {
			throw new Error("Soft delete not supported for this table.");
		}

		await this.db
			.update(this.table)
			.set({
				deletedAt: new Date(),
				updatedAt: new Date(),
			} as unknown as TTable["$inferInsert"])
			.where(inArray(tableCols["id"], ids));
	}

	async bulkRestore(ids: number[]): Promise<void> {
		if (ids.length === 0) return;

		const tableCols = this.table as unknown as TableWithColumns<TTable>;

		// Build payload dynamically — only include columns that exist
		const payload: Record<string, unknown> = {
			updatedAt: new Date(),
		};

		if ("deletedAt" in tableCols) {
			payload["deletedAt"] = null;
		}

		if (!("id" in tableCols)) {
			throw new Error('This table does not have an "id" column.');
		}

		await this.db
			.update(this.table)
			.set(payload as Partial<TTable["$inferInsert"]>)
			.where(inArray(tableCols["id"], ids));
	}

	async bulkDelete(ids: number[]): Promise<void> {
		if (ids.length === 0) return;

		const tableCols = this.table as unknown as TableWithColumns<TTable>;

		if (!("id" in tableCols)) {
			throw new Error('This table does not have an "id" column.');
		}

		await this.db.delete(this.table).where(inArray(tableCols["id"], ids));
	}
}
