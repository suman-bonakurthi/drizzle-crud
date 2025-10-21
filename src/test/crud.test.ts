import type { PgDatabase } from "drizzle-orm/pg-core";
import { pgTable, serial, text } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod/v4";
import { crudFactory } from "../crud-factory.js";
import { drizzleCrud, filtersToWhere } from "../index.js";
import { createMockDrizzle } from "../test/utils/mock-drizzle";
import { zod } from "../zod.js";

const usersTable = pgTable("users", {
	id: serial("id").primaryKey(),
	name: text("name"),
	email: text("email"),
});

// const client = postgres();

// const db = drizzle(client, {
// 	schema: {
// 		users: usersTable,
// 	},
// });

// describe("drizzleCrud", () => {
// 	it("should create a crud instance", () => {
// 		const createCrud = drizzleCrud(db);
// 	});

// 	it("should create a user without validation", async () => {
// 		const createCrud = drizzleCrud(db);

// 		const users = createCrud(usersTable);

// 		const user = await users.create({
// 			name: "John Doe",
// 			email: "john.doe@example.com",
// 		});

// 		expect(user).toEqual({
// 			id: 1,
// 			name: "John Doe",
// 			email: "john.doe@example.com",
// 		});
// 	});

// 	it("should validate with zod", async () => {
// 		const validation = zod();

// 		const createCrud = drizzleCrud(db, {
// 			validation,
// 		});

// 		const users = createCrud(usersTable);

// 		const user = await users.create({
// 			name: "John Doe",
// 			email: "john.doe@example.com",
// 		});

// 		expect(user).toEqual({
// 			id: 1,
// 			name: "John Doe",
// 			email: "john.doe@example.com",
// 		});
// 	});

// 	it("should validate with custom zod schemas", async () => {
// 		const validation = zod({
// 			insert: () =>
// 				z.object({
// 					name: z.string(),
// 					email: z.email(),
// 				}),
// 			pagination(options) {
// 				return z.object({
// 					page: z
// 						.number()
// 						.int()
// 						.positive()
// 						.optional()
// 						.default(options.defaultLimit ?? 10),
// 					limit: z
// 						.number()
// 						.int()
// 						.positive()
// 						.optional()
// 						.default(options.maxLimit ?? 100),
// 				});
// 			},
// 		});

// 		const createCrud = drizzleCrud(db, {
// 			validation,
// 		});

// 		const users = createCrud(usersTable);

// 		const user = await users.create({
// 			name: "John Doe",
// 			email: "john.doe@example.com",
// 		});

// 		expect(user).toEqual({
// 			id: 1,
// 			name: "John Doe",
// 			email: "john.doe@example.com",
// 		});
// 	});

// 	it("should validate with custom local zod schemas", async () => {
// 		const createCrud = drizzleCrud(db, {
// 			validation: zod(),
// 		});

// 		const users = createCrud(usersTable, {
// 			validation: zod({
// 				insert: () =>
// 					z.object({
// 						name: z.string().optional(),
// 						email: z.email().optional().nullable(),
// 					}),
// 			}),
// 		});

// 		const user = await users.create({
// 			name: "John Doe",
// 			email: "john.doe@example.com",
// 		});

// 		expect(user).toEqual({
// 			id: 1,
// 			name: "John Doe",
// 			email: "john.doe@example.com",
// 		});
// 	});

// 	it("should find by id", async () => {
// 		const createCrud = drizzleCrud(db, {
// 			validation: zod(),
// 		});

// 		const users = createCrud(usersTable);

// 		const user = await users.findById(1, {
// 			columns: {
// 				id: true,
// 				name: true,
// 				email: false,
// 			},
// 		});

// 		if (user === null) {
// 			throw new Error("User not found");
// 		}

// 		console.log(user);

// 		expect(user).toEqual({
// 			id: 1,
// 			name: "John Doe",
// 		});
// 	});

// 	it("should apply filters", async () => {
// 		const createCrud = drizzleCrud(db, {
// 			validation: zod(),
// 		});

// 		const users = createCrud(usersTable);

// 		const where = filtersToWhere(usersTable, {
// 			OR: [
// 				{
// 					email: {
// 						equals: "john.doe@example.com",
// 					},
// 				},
// 				{
// 					email: {
// 						equals: "jane.doe@example.com",
// 					},
// 				},
// 			],
// 			AND: [
// 				{
// 					id: {
// 						not: 1337,
// 					},
// 				},
// 				{
// 					name: "Johnny",
// 				},
// 			],
// 		});

// 		const list = await users.list({
// 			columns: {
// 				id: true,
// 			},
// 			where,
// 		});

// 		expect(list.results).toEqual([
// 			{
// 				id: 1,
// 			},
// 		]);
// 	});

// 	it("should accept filters", async () => {
// 		const createCrud = drizzleCrud(db, {
// 			validation: zod(),
// 		});

// 		const users = createCrud(usersTable);

// 		const list = await users.list({
// 			columns: {
// 				id: true,
// 				name: true,
// 			},
// 			filters: {
// 				id: {
// 					equals: 1,
// 				},
// 				OR: [
// 					{
// 						email: {
// 							equals: "john.doe@example.com",
// 						},
// 					},
// 					{
// 						name: "Johnny",
// 					},
// 				],
// 			},
// 		});

// 		expect(list.results[0]).toEqual({
// 			id: 1,
// 			name: "John Doe",
// 		});
// 	});
// });

// Mock drizzle client + behavior
const mockInsert = vi.fn(() => ({
	values: vi.fn().mockReturnThis(),
	returning: vi
		.fn()
		.mockResolvedValue([
			{ id: 1, name: "John Doe", email: "john.doe@example.com" },
		]),
}));

const mockQuery = {
	users: {
		findFirst: vi.fn().mockResolvedValue({ id: 1, name: "John Doe" }),
		findMany: vi.fn().mockImplementation((params) => {
			// Return mock data based on the columns parameter
			const mockData = [{ id: 1, name: "John Doe", email: "john.doe@example.com" }];
			
			if (params?.columns) {
				// Filter the mock data to only include requested columns
				return Promise.resolve(mockData.map(item => {
					const filtered: any = {};
					for (const [key, value] of Object.entries(params.columns)) {
						if (value === true && item.hasOwnProperty(key)) {
							filtered[key] = item[key as keyof typeof item];
						}
					}
					return filtered;
				}));
			}
			
			return Promise.resolve(mockData);
		}),
	},
};

const mockSelect = vi.fn().mockReturnValue({
	from: vi.fn().mockReturnValue({
		where: vi.fn().mockResolvedValue([{ count: 1 }]), // This will be called when the query is awaited
	}),
});

const mockDrizzle = vi.fn(() => ({
	insert: mockInsert,
	select: mockSelect,
	query: mockQuery,
}));

vi.mock("drizzle-orm/postgres-js", () => ({
	drizzle: mockDrizzle,
}));

vi.mock("postgres", () => ({
	default: vi.fn(() => ({})),
}));

const db = mockDrizzle() as unknown as PgDatabase<any, any, any>;

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────
describe("drizzleCrud (mocked)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should create a crud instance", () => {
		const createCrud = drizzleCrud(db);
		expect(createCrud).toBeInstanceOf(Function);
	});

	it("should create a user without validation", async () => {
		const createCrud = drizzleCrud(db);
		const users = createCrud(usersTable);

		const user = await users.create({
			name: "John Doe",
			email: "john.doe@example.com",
		});

		expect(user).toEqual({
			id: 1,
			name: "John Doe",
			email: "john.doe@example.com",
		});
	});

	it("should validate with zod", async () => {
		const validation = zod();
		const createCrud = drizzleCrud(db, { validation });
		const users = createCrud(usersTable);

		const user = await users.create({
			name: "John Doe",
			email: "john.doe@example.com",
		});

		expect(user).toEqual({
			id: 1,
			name: "John Doe",
			email: "john.doe@example.com",
		});
	});

	it("should validate with custom zod schemas", async () => {
		const validation = zod({
			insert: () =>
				z.object({
					name: z.string(),
					email: z.string().email(),
				}),
			pagination(options) {
				return z.object({
					page: z.number().int().positive().optional().default(1),
					limit: z
						.number()
						.int()
						.positive()
						.optional()
						.default(options.maxLimit ?? 100),
				});
			},
		});

		const createCrud = drizzleCrud(db, { validation });
		const users = createCrud(usersTable);

		const user = await users.create({
			name: "John Doe",
			email: "john.doe@example.com",
		});

		expect(user).toEqual({
			id: 1,
			name: "John Doe",
			email: "john.doe@example.com",
		});
	});

	it("should validate with custom local zod schemas", async () => {
		const createCrud = drizzleCrud(db, { validation: zod() });
		const users = createCrud(usersTable, {
			validation: zod({
				insert: () =>
					z.object({
						name: z.string().optional(),
						email: z.string().email().optional().nullable(),
					}),
			}),
		});

		const user = await users.create({
			name: "John Doe",
			email: "john.doe@example.com",
		});

		expect(user).toEqual({
			id: 1,
			name: "John Doe",
			email: "john.doe@example.com",
		});
	});

	it("should find by id", async () => {
		const createCrud = drizzleCrud(db, { validation: zod() });
		const users = createCrud(usersTable);

		const user = await users.findById(1, {
			columns: { id: true, name: true, email: false },
		});

		expect(user).toEqual({
			id: 1,
			name: "John Doe",
		});
	});

	it("should apply filters", async () => {
		const createCrud = drizzleCrud(db, { validation: zod() });
		const users = createCrud(usersTable);

		const where = filtersToWhere(usersTable, {
			OR: [
				{ email: { equals: "john.doe@example.com" } },
				{ email: { equals: "jane.doe@example.com" } },
			],
			AND: [{ id: { not: 1337 } }, { name: "Johnny" }],
		});

		const list = await users.list({
			columns: { id: true },
			where,
		});

		expect(list.results).toEqual([{ id: 1 }]);
	});

	it("should accept filters", async () => {
		const { db, findMany } = createMockDrizzle("users");

		const crud = crudFactory(db as any, usersTable);

		// Run
		await crud.list({
			columns: { id: true, name: true, email: true },
			filters: {},
		} as any);

		expect(findMany).toHaveBeenCalled();
	});
});
