import { ConflictException, NotFoundException, InternalServerErrorException, ForbiddenException } from "@nestjs/common";
import { eq, ne, and, isNull, inArray } from "drizzle-orm";
import { AbstractRepository } from "../abstract.repository";
import { BaseQueryBuilder } from "../base.query.builder";
import { BaseEntity, FindAllOptions, DrizzleDatabase, GenericDrizzleSchema } from "../base.types";

// Mock the dependencies
jest.mock("../base.query.builder");

// Create a test implementation of the abstract repository with simplified types
class TestRepository extends AbstractRepository<any, any, any, any, any> {
  protected configService = {
    get: jest.fn(),
  };
  protected allowedSortColumns = ["id", "name", "createdAt"];
  protected allowedFilterColumns = ["name", "email"];
}

describe("AbstractRepository", () => {
  let repository: TestRepository;
  let mockDb: any;
  let mockTable: any;
  let mockSchema: any;

  beforeEach(() => {
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      transaction: jest.fn(),
    };

    mockTable = {
      _: { name: "users" },
      id: { id: "id", table: { name: "users" } },
      name: { name: "name", table: { name: "users" } },
      email: { name: "email", table: { name: "users" } },
      deletedAt: { name: "deletedAt", table: { name: "users" } },
      updatedAt: { name: "updatedAt", table: { name: "users" } },
      createdAt: { name: "createdAt", table: { name: "users" } },
    };

    mockSchema = {};

    repository = new TestRepository(mockDb, mockTable, mockSchema);
  });

  describe("constructor", () => {
    it("should initialize with the correct dependencies", () => {
      expect(repository).toBeDefined();
    });
  });

  describe("findAll", () => {
    it("should call BaseQueryBuilder with correct parameters", async () => {
      const mockFilterQuery = { limit: 10, offset: 0 };
      (BaseQueryBuilder as jest.Mock).mockImplementation(() => ({
        execute: jest.fn().mockResolvedValue([]),
      }));

      const result = await repository.findAll(mockFilterQuery);

      expect(BaseQueryBuilder).toHaveBeenCalledWith({
        db: mockDb,
        table: mockTable,
        schema: mockSchema,
        options: undefined,
        allowedSortColumns: ["id", "name", "createdAt"],
        allowedFilterColumns: ["name", "email"],
        configService: expect.any(Object),
        filterQuery: mockFilterQuery,
      });
      expect(result).toEqual([]);
    });
  });

  describe("create", () => {
    it("should create a new entity", async () => {
      const mockDto = { name: "Test User", email: "test@example.com" };
      const mockResult = [{ id: 1, name: "Test User", email: "test@example.com", createdAt: new Date(), updatedAt: new Date(), deletedAt: null }];
      
      mockDb.insert.mockReturnThis();
      mockDb.values.mockReturnThis();
      mockDb.returning.mockResolvedValue(mockResult);

      const result = await repository.create(mockDto);

      expect(mockDb.insert).toHaveBeenCalledWith(mockTable);
      expect(mockDb.values).toHaveBeenCalledWith(mockDto);
      expect(result).toEqual(mockResult[0]);
    });

    it("should validate unique fields when options are provided", async () => {
      const mockDto = { name: "Test User", email: "test@example.com" };
      const mockResult = [{ id: 1, name: "Test User", email: "test@example.com", createdAt: new Date(), updatedAt: new Date(), deletedAt: null }];
      
      mockDb.insert.mockReturnThis();
      mockDb.values.mockReturnThis();
      mockDb.returning.mockResolvedValue(mockResult);

      // Spy on checkUniqueFields to verify it's called
      const checkUniqueFieldsSpy = jest.spyOn(repository as any, 'checkUniqueFields');
      
      await repository.create(mockDto, { uniqueFields: ["email"] });

      expect(checkUniqueFieldsSpy).toHaveBeenCalledWith(mockDto, ["email"]);
    });
  });

  describe("update", () => {
    it("should update an existing entity", async () => {
      const mockExisting = [{ id: 1, name: "Old Name", email: "test@example.com", createdAt: new Date(), updatedAt: new Date(), deletedAt: null }];
      const mockUpdated = [{ id: 1, name: "New Name", email: "test@example.com", createdAt: new Date(), updatedAt: new Date(), deletedAt: null }];
      
      // Mock the select chain
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockResolvedValue(mockExisting);
      
      // Mock the update chain with returning
      const mockUpdateChain = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue(mockUpdated),
      };
      mockDb.update.mockReturnValue(mockUpdateChain);

      const result = await repository.update(1, { name: "New Name" });

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalledWith(mockTable);
      expect(result).toEqual(mockUpdated[0]);
    });

    it("should throw NotFoundException if entity doesn't exist", async () => {
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockResolvedValue([]);

      await expect(repository.update(1, { name: "New Name" })).rejects.toThrow(NotFoundException);
    });
  });

  describe("findOne", () => {
    it("should find an entity by ID", async () => {
      const mockResult = [{ id: 1, name: "Test User", email: "test@example.com", createdAt: new Date(), updatedAt: new Date(), deletedAt: null }];
      
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockResolvedValue(mockResult);

      const result = await repository.findOne(1);

      expect(mockDb.select).toHaveBeenCalled();
      expect(result).toEqual(mockResult[0]);
    });

    it("should throw NotFoundException if entity doesn't exist", async () => {
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockResolvedValue([]);

      await expect(repository.findOne(1)).rejects.toThrow(NotFoundException);
    });
  });

  describe("remove (soft delete)", () => {
    it("should soft delete an entity", async () => {
      const mockResult = [{ id: 1, name: "Test User", email: "test@example.com", createdAt: new Date(), updatedAt: new Date(), deletedAt: new Date() }];
      
      const mockUpdateChain = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue(mockResult),
      };
      mockDb.update.mockReturnValue(mockUpdateChain);

      const result = await repository.remove(1);

      expect(mockDb.update).toHaveBeenCalledWith(mockTable);
      expect(result).toEqual(mockResult[0]);
    });
  });

  describe("purge (hard delete)", () => {
    it("should hard delete an entity", async () => {
      const mockExisting = [{ id: 1, name: "Test User", email: "test@example.com", createdAt: new Date(), updatedAt: new Date(), deletedAt: new Date() }];
      
      // First where call is for fetching the entity, second is for the delete operation
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockResolvedValueOnce(mockExisting); // Fetch entity

      mockDb.delete.mockReturnThis();
      mockDb.where.mockReturnThis(); // For the delete operation

      const result = await repository.purge(1);

      expect(mockDb.delete).toHaveBeenCalledWith(mockTable);
      expect(result).toEqual(mockExisting[0]);
    });

    it("should throw ForbiddenException if entity is not soft deleted", async () => {
      const mockExisting = [{ id: 1, name: "Test User", email: "test@example.com", createdAt: new Date(), updatedAt: new Date(), deletedAt: null }];
      
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockResolvedValue(mockExisting);

      await expect(repository.purge(1)).rejects.toThrow(ForbiddenException);
    });
  });

  describe("restore", () => {
    it("should restore a soft deleted entity", async () => {
      const mockExisting = [{ id: 1, name: "Test User", email: "test@example.com", createdAt: new Date(), updatedAt: new Date(), deletedAt: new Date() }];
      const mockRestored = [{ id: 1, name: "Test User", email: "test@example.com", createdAt: new Date(), updatedAt: new Date(), deletedAt: null }];
      
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockResolvedValue(mockExisting);
      
      const mockUpdateChain = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue(mockRestored),
      };
      mockDb.update.mockReturnValue(mockUpdateChain);

      const result = await repository.restore(1);

      expect(mockDb.update).toHaveBeenCalledWith(mockTable);
      expect(result).toEqual(mockRestored[0]);
    });
  });

  describe("bulkCreate", () => {
    it("should create multiple entities", async () => {
      const mockDtos = [
        { name: "User 1", email: "user1@example.com" },
        { name: "User 2", email: "user2@example.com" }
      ];
      const mockResults = [
        { id: 1, name: "User 1", email: "user1@example.com", createdAt: new Date(), updatedAt: new Date(), deletedAt: null },
        { id: 2, name: "User 2", email: "user2@example.com", createdAt: new Date(), updatedAt: new Date(), deletedAt: null }
      ];
      
      mockDb.transaction.mockImplementation(async (callback: any) => {
        const tx = {
          insert: jest.fn().mockReturnThis(),
          values: jest.fn().mockReturnThis(),
          returning: jest.fn().mockResolvedValue(mockResults)
        };
        return await callback(tx);
      });

      const result = await repository.bulkCreate(mockDtos);

      expect(mockDb.transaction).toHaveBeenCalled();
      expect(result).toEqual(mockResults);
    });
  });

  describe("bulkUpdate", () => {
    it("should update multiple entities", async () => {
      const mockRecords = [
        { id: 1, data: { name: "Updated User 1" } },
        { id: 2, data: { name: "Updated User 2" } }
      ];
      const mockResults = [
        { id: 1, name: "Updated User 1", email: "user1@example.com", createdAt: new Date(), updatedAt: new Date(), deletedAt: null },
        { id: 2, name: "Updated User 2", email: "user2@example.com", createdAt: new Date(), updatedAt: new Date(), deletedAt: null }
      ];
      
      // Create mock for each update operation within the transaction
      mockDb.transaction.mockImplementation(async (callback: any) => {
        // For bulkUpdate, the transaction function processes each record individually
        // and returns an array of updated entities
        const tx = {
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          returning: jest.fn().mockResolvedValueOnce([mockResults[0]]).mockResolvedValueOnce([mockResults[1]])
        };
        
        // Execute the callback with the transaction object
        await callback(tx);
        
        // Return the combined results
        return mockResults;
      });

      const result = await repository.bulkUpdate(mockRecords);

      expect(mockDb.transaction).toHaveBeenCalled();
      expect(result).toEqual(mockResults);
    });
  });

  describe("bulkSoftDelete", () => {
    it("should soft delete multiple entities", async () => {
      const ids = [1, 2, 3];
      
      mockDb.update.mockReturnThis();
      mockDb.set.mockReturnThis();
      mockDb.where.mockReturnThis();

      await repository.bulkSoftDelete(ids);

      expect(mockDb.update).toHaveBeenCalledWith(mockTable);
      expect(mockDb.set).toHaveBeenCalledWith({
        deletedAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(mockDb.where).toHaveBeenCalledWith(inArray(mockTable.id, ids));
    });
  });

  describe("checkUniqueFields", () => {
    it("should not throw an error if unique fields are not violated", async () => {
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockResolvedValue([]);

      await expect(
        (repository as any).checkUniqueFields({ email: "test@example.com" }, ["email"])
      ).resolves.not.toThrow();
    });

    it("should throw ConflictException if unique field is violated", async () => {
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockResolvedValue([{ id: 1, email: "test@example.com" }]);

      await expect(
        (repository as any).checkUniqueFields({ email: "test@example.com" }, ["email"])
      ).rejects.toThrow(ConflictException);
    });
  });
});