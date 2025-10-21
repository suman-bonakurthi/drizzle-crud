// test/utils/mock-drizzle.ts
import { vi } from "vitest";

// Minimal mock of Drizzle database and query builder
export function createMockDrizzle(tableName: string) {
	const findMany = vi.fn().mockResolvedValue([]);
	const findFirst = vi.fn().mockResolvedValue(null);

	const db = {
		insert: vi.fn().mockReturnValue({
			values: vi.fn().mockReturnValue({
				returning: vi.fn().mockResolvedValue([{ id: 1 }]),
			}),
		}),
		update: vi.fn().mockReturnValue({
			set: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					returning: vi.fn().mockResolvedValue([{ id: 1 }]),
				}),
			}),
		}),
		delete: vi.fn().mockReturnValue({
			where: vi.fn().mockResolvedValue({ rowCount: 1 }),
		}),
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		query: {
			[tableName]: {
				findMany,
				findFirst,
			},
		},
	};

	return { db, findMany, findFirst };
}
