import {
	and,
	AnyColumn,
	asc,
	desc,
	eq,
	exists,
	ilike,
	isNull,
	SQL,
} from "drizzle-orm";
import { AnyPgTable } from "drizzle-orm/pg-core";
// --- IMPORTS FIXED FOR PACKAGE STRUCTURE ---
import {
	CrudQueryBuilderDependencies,
	GenericDrizzleSchema,
	RelationOptions,
	TableWithColumns,
} from "./base.types";
import {
	CONFIG_NAMESPACE,
	PAGINATION_DEFAULTS,
} from "./config/drizzle-crud.pagination.config";

interface MinimalPaginationQuery {
	limit?: number;
	offset?: number;
	sortBy?: string;
	order?: "asc" | "desc";
}
// -------------------------------------------

/**
 * @description Implements the complex findAll logic (Pagination, Sorting, Filtering, Relation-based EXIST queries).
 * Adheres to SRP by separating query building from the primary CRUD interface.
 */
export class BaseQueryBuilder<
	TTable extends AnyPgTable,
	TEntity,
	// ✅ FIXED: Constrain TFilterDto directly with the minimal pagination properties
	TFilterDto extends MinimalPaginationQuery,
	TSchema extends GenericDrizzleSchema,
> {
	// ✅ Use CrudQueryBuilderDependencies and TSchema generic
	private readonly deps: CrudQueryBuilderDependencies<
		TTable,
		TFilterDto,
		TSchema
	>;

	// ✅ FIX: The 'table' property now has an initializer in the constructor
	protected readonly table: TTable;

	constructor(deps: CrudQueryBuilderDependencies<TTable, TFilterDto, TSchema>) {
		this.deps = deps;
		this.table = deps.table; // <-- INITIALIZATION ADDED
	}

	private resolveRelatedTable(
		relationName: string,
		cfg?: RelationOptions,
	): AnyPgTable | undefined {
		// ✅ FIXED: Use this.deps.schema instead of the removed global import
		const schemaMap = this.deps.schema as unknown as Record<string, AnyPgTable>;

		// 1. Check for explicit tableName configuration
		if (cfg?.tableName && typeof cfg.tableName === "string") {
			const key = cfg.tableName;
			if (key in schemaMap) return schemaMap[key];
			return undefined;
		}

		// 2. Default Fallback logic: check for 'relationName' (e.g., 'countries' table for 'country' relation)
		if (relationName in schemaMap) {
			return schemaMap[relationName];
		}

		return undefined; // If no match, return undefined
	}

	private getTableQuery() {
		// Cast the generic table to 'any' for simpler property access
		interface DrizzleTableNameAccessor {
			// Standard internal name property
			_?: { name?: string };

			// Property for the Drizzle symbol (key is a symbol, value is string)
			[key: symbol]: string | undefined;

			// Optional method that some table wrappers might expose
			getTableName?: () => string;
		}

		// 2. Use 'as unknown as' to cast to the specialized interface, avoiding 'any'
		const table = this.deps.table as unknown as DrizzleTableNameAccessor;

		const DrizzleNameSymbol = Symbol.for("drizzle:Name");
		let tableName: string | undefined;

		tableName = table?._?.name;

		// Attempt 2: Drizzle symbol property (check for the symbol before accessing it)
		if (typeof tableName !== "string" && DrizzleNameSymbol in table) {
			const symbolValue = table[DrizzleNameSymbol];
			if (typeof symbolValue === "string") {
				tableName = symbolValue;
			}
		}

		// Attempt 3: Check for the getTableName function
		if (
			typeof tableName !== "string" &&
			typeof table.getTableName === "function"
		) {
			tableName = table.getTableName();
		}

		// Final validation and error throw
		if (
			typeof tableName !== "string" ||
			!tableName ||
			!(tableName in this.deps.db.query)
		) {
			throw new Error(
				`No valid query found for table: ${String(tableName)}. 
         Ensure the table object is correctly passed to AbstractRepository 
         and that your Drizzle schema is correctly mapped.`,
			);
		}

		// Define the necessary query structure
		type DrizzleQueryMap = Record<
			string,
			{
				findMany?: (config?: Record<string, unknown>) => Promise<unknown[]>;
				findFirst?: (config?: Record<string, unknown>) => Promise<unknown>;
			}
		>;

		const tableQuery = (this.deps.db.query as DrizzleQueryMap)[tableName];

		if (!tableQuery?.findMany) {
			throw new Error(
				`The Drizzle ORM query object for table '${tableName}' is missing the 'findMany' method.`,
			);
		}

		return tableQuery as Required<DrizzleQueryMap[string]>;
	}

	// --- Main Query Logic (findAll) ---

	public async execute(): Promise<TEntity[]> {
		const {
			table,
			options,
			configService,
			allowedFilterColumns,
			allowedSortColumns,
			filterQuery,
		} = this.deps;
		const tableCols = table as unknown as TableWithColumns<TTable>;

		// 1. Pagination & Sorting setup
		const defaultLimit = configService.get(
			`${CONFIG_NAMESPACE}.limit`,
			PAGINATION_DEFAULTS.limit,
		) as number;
		const defaultOffset = configService.get(
			`${CONFIG_NAMESPACE}.offset`,
			PAGINATION_DEFAULTS.offset,
		) as number;

		const limit = filterQuery.limit ?? defaultLimit;
		const offset = filterQuery.offset ?? defaultOffset;

		const sortBy =
			filterQuery.sortBy &&
			allowedSortColumns.includes(filterQuery.sortBy as string)
				? (filterQuery.sortBy as string)
				: "id";

		const resolvedSortColumn = tableCols[sortBy] ?? tableCols["id"];
		const orderExpr: SQL =
			filterQuery.order === "desc"
				? desc(resolvedSortColumn)
				: asc(resolvedSortColumn);

		// 2. Build WHERE Conditions
		const conditions: SQL[] = [];
		if ("deletedAt" in tableCols) {
			conditions.push(isNull(tableCols["deletedAt"]));
		}

		// Direct filters
		for (const key of allowedFilterColumns) {
			const value = (filterQuery as Record<string, unknown>)[key];
			if (typeof value === "string" && value.trim() && key in tableCols) {
				conditions.push(ilike(tableCols[key], `%${value.trim()}%`));
			}
		}

		// Relation-based filters (EXIST subqueries) - Your dynamic logic
		if (options?.relations) {
			for (const [relationName, relationConfig] of Object.entries(
				options.relations,
			)) {
				const cfg = relationConfig as RelationOptions;
				const searchableColumns = cfg?.searchableColumns ?? [];

				const relatedTable = this.resolveRelatedTable(relationName, cfg);
				if (!relatedTable) continue;

				const relatedCols = relatedTable as unknown as Record<
					string,
					AnyColumn
				>;

				const fk = cfg?.foreignKey ?? `${relationName}Id`;

				for (const column of searchableColumns) {
					const paramName = `${relationName}${column.charAt(0).toUpperCase()}${column.slice(1)}`;
					const searchValue = (filterQuery as Record<string, unknown>)[
						paramName
					];

					if (typeof searchValue === "string" && searchValue.trim() !== "") {
						if (!(column in relatedCols)) continue;

						let joinCondition: SQL<boolean> | undefined;

						const fkOnBase = fk in tableCols;
						const fkOnRelated = fk in relatedCols;

						if (fkOnBase && !fkOnRelated) {
							if (fk in tableCols) {
								joinCondition = eq(
									tableCols[fk],
									relatedCols["id"],
								) as SQL<boolean>;
							}
						} else if (fkOnRelated) {
							if (fk in tableCols) {
								joinCondition = eq(
									tableCols["id"],
									relatedCols[fk],
								) as SQL<boolean>;
							}
						} else {
							continue;
						}

						if (!joinCondition) continue;

						conditions.push(
							exists(
								this.deps.db
									.select()
									.from(relatedTable)
									.where(
										and(
											joinCondition,
											ilike(
												relatedCols[column],
												`%${String(searchValue).trim()}%`,
											),
										),
									),
							) as SQL<boolean>,
						);
					}
				}
			}
		}

		// 3. Final Query Execution
		const whereExpr =
			conditions.length > 0 ? (and(...conditions) as SQL) : undefined;
		const query = this.getTableQuery();

		// 4. Columns Projection
		// Define the expected type for the accumulator (acc) explicitly
		type Accumulator = Record<string, AnyColumn>;

		// Map the selected columns to an object format required by Drizzle
		const columnsProjection = options?.selectedColumns
			? options.selectedColumns.reduce(
					(acc: Accumulator, k: keyof TTable["_"]["columns"] | string) => {
						const colKey = k as keyof TTable["_"]["columns"];
						// Ensure the column exists on the table object before spreading it
						if (tableCols[colKey as string]) {
							// @ts-expect-error Drizzle inference on the column accessor is complex
							acc[colKey] = tableCols[colKey];
						}
						return acc;
					},
					{} as Accumulator, // Initialize with the correct type
				)
			: undefined;

		// 5. Execution
		const results = await query.findMany({
			where: whereExpr,
			limit,
			offset,
			orderBy: orderExpr,
			with: options?.relations ?? undefined,
			columns: columnsProjection, // Pass the transformed projection object
		});

		return results as TEntity[];
	}
}
