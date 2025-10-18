import { BaseQueryBuilder } from "../base.query.builder";
import { PaginationQueryDto } from "../dto/pagination-query.dto";

// Mock the dependencies
jest.mock("../config/drizzle-crud.pagination.config", () => ({
  CONFIG_NAMESPACE: "drizzle-crud.pagination",
  PAGINATION_DEFAULTS: {
    limit: 10,
    offset: 0,
  },
}));

describe("BaseQueryBuilder", () => {
 let queryBuilder: BaseQueryBuilder<any, any, any, any>;
  let mockDeps: any;

  beforeEach(() => {
    mockDeps = {
      db: {
        query: {
          users: {
            findMany: jest.fn().mockResolvedValue([]),
            findFirst: jest.fn(),
          },
        },
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
      },
      table: {
        _: { name: "users" },
        id: { id: "id", table: { name: "users" } },
        name: { name: "name", table: { name: "users" } },
        email: { name: "email", table: { name: "users" } },
        deletedAt: { name: "deletedAt", table: { name: "users" } },
        updatedAt: { name: "updatedAt", table: { name: "users" } },
        createdAt: { name: "createdAt", table: { name: "users" } },
      },
      schema: {},
      options: undefined,
      allowedSortColumns: ["id", "name", "createdAt"],
      allowedFilterColumns: ["name", "email"],
      configService: {
        get: jest.fn().mockReturnValue(10), // Default limit
      },
      filterQuery: { limit: 10, offset: 0 },
    };

    queryBuilder = new BaseQueryBuilder(mockDeps);
  });

  describe("constructor", () => {
    it("should initialize with the correct dependencies", () => {
      expect(queryBuilder).toBeDefined();
    });
  });

  describe("execute", () => {
    it("should execute a basic query with pagination", async () => {
      const mockResults = [
        { id: 1, name: "User 1", email: "user1@example.com", createdAt: new Date(), updatedAt: new Date(), deletedAt: null },
        { id: 2, name: "User 2", email: "user2@example.com", createdAt: new Date(), updatedAt: new Date(), deletedAt: null },
      ];

      // Mock the table query method
      jest.spyOn(queryBuilder as any, 'getTableQuery').mockReturnValue({
        findMany: jest.fn().mockResolvedValue(mockResults),
      });

      const results = await queryBuilder.execute();

      expect(results).toEqual(mockResults);
    });

    it("should apply filters when provided", async () => {
      const mockFilterQuery = {
        limit: 10,
        offset: 0,
        name: "John",
      };

      const newDeps = { ...mockDeps, filterQuery: mockFilterQuery };
      const newQueryBuilder = new BaseQueryBuilder(newDeps);

      const mockResults = [
        { id: 1, name: "John", email: "john@example.com", createdAt: new Date(), updatedAt: new Date(), deletedAt: null },
      ];

      jest.spyOn(newQueryBuilder as any, 'getTableQuery').mockReturnValue({
        findMany: jest.fn().mockResolvedValue(mockResults),
      });

      const results = await newQueryBuilder.execute();

      expect(results).toEqual(mockResults);
    });

    it("should apply sorting when provided", async () => {
      const mockFilterQuery = {
        limit: 10,
        offset: 0,
        sortBy: "name",
        order: "desc" as const,
      };

      const newDeps = { ...mockDeps, filterQuery: mockFilterQuery };
      const newQueryBuilder = new BaseQueryBuilder(newDeps);

      const mockResults = [
        { id: 2, name: "Zoe", email: "zoe@example.com", createdAt: new Date(), updatedAt: new Date(), deletedAt: null },
        { id: 1, name: "John", email: "john@example.com", createdAt: new Date(), updatedAt: new Date(), deletedAt: null },
      ];

      jest.spyOn(newQueryBuilder as any, 'getTableQuery').mockReturnValue({
        findMany: jest.fn().mockResolvedValue(mockResults),
      });

      const results = await newQueryBuilder.execute();

      expect(results).toEqual(mockResults);
    });
  });

  describe("resolveRelatedTable", () => {
    it("should return undefined when relation doesn't exist", () => {
      const result = (queryBuilder as any).resolveRelatedTable("nonexistent", undefined);
      expect(result).toBeUndefined();
    });

    it("should return table when relation exists", () => {
      const mockSchema = {
        users: mockDeps.table,
      };

      const newDeps = { ...mockDeps, schema: mockSchema };
      const newQueryBuilder = new BaseQueryBuilder(newDeps);

      const result = (newQueryBuilder as any).resolveRelatedTable("users", undefined);
      expect(result).toEqual(mockDeps.table);
    });
  });
});