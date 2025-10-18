import { DrizzleCrudPaginationConfig, PAGINATION_DEFAULTS, CONFIG_NAMESPACE } from "../config/drizzle-crud.pagination.config";

describe("Pagination Configuration", () => {
  describe("PAGINATION_DEFAULTS", () => {
    it("should have correct default values", () => {
      expect(PAGINATION_DEFAULTS).toEqual({
        limit: 10,
        offset: 0,
      });
    });
  });

  describe("CONFIG_NAMESPACE", () => {
    it("should have the correct namespace", () => {
      expect(CONFIG_NAMESPACE).toBe("drizzle-crud.pagination");
    });
  });

 describe("DrizzleCrudPaginationConfig", () => {
    beforeEach(() => {
      // Clean up environment variables before each test
      delete process.env.DRIZZLE_CRUD_PAGINATION_LIMIT;
      delete process.env.DRIZZLE_CRUD_PAGINATION_OFFSET;
    });

    it("should return default values when no environment variables are set", () => {
      const config = DrizzleCrudPaginationConfig();

      expect(config).toEqual({
        limit: 10,
        offset: 0,
      });
    });

    it("should use environment variables when provided", () => {
      process.env.DRIZZLE_CRUD_PAGINATION_LIMIT = "25";
      process.env.DRIZZLE_CRUD_PAGINATION_OFFSET = "5";

      const config = DrizzleCrudPaginationConfig();

      expect(config).toEqual({
        limit: 25,
        offset: 5,
      });
    });

    it("should handle string environment variables and convert to numbers", () => {
      process.env.DRIZZLE_CRUD_PAGINATION_LIMIT = "50";
      process.env.DRIZZLE_CRUD_PAGINATION_OFFSET = "10";

      const config = DrizzleCrudPaginationConfig();

      expect(config).toEqual({
        limit: 50,
        offset: 10,
      });
    });

    it("should return NaN when environment variables are invalid", () => {
      process.env.DRIZZLE_CRUD_PAGINATION_LIMIT = "invalid";
      process.env.DRIZZLE_CRUD_PAGINATION_OFFSET = "also_invalid";

      // Since parseInt("invalid", 10) returns NaN, the config will return NaN values
      const config = DrizzleCrudPaginationConfig();

      expect(config.limit).toBeNaN();
      expect(config.offset).toBeNaN();
    });
  });
});