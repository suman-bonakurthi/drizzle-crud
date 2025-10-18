import { PaginationQueryDto } from "../dto/pagination-query.dto";
import { validate } from "class-validator";

describe("PaginationQueryDto", () => {
  it("should validate a valid pagination query", async () => {
    const dto = new PaginationQueryDto();
    dto.limit = 10;
    dto.offset = 5;
    dto.sortBy = "name";
    dto.order = "asc";

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("should accept undefined values", async () => {
    const dto = new PaginationQueryDto();

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("should reject negative limit", async () => {
    const dto = new PaginationQueryDto();
    dto.limit = -5;

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe("limit");
    expect(errors[0].constraints).toHaveProperty("isPositive");
  });

  it("should reject negative offset", async () => {
    const dto = new PaginationQueryDto();
    dto.offset = -1;

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe("offset");
    expect(errors[0].constraints).toHaveProperty("min");
  });

  it("should reject invalid order value", async () => {
    const dto = new PaginationQueryDto();
    dto.order = "invalid" as any;

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe("order");
    expect(errors[0].constraints).toHaveProperty("isIn");
  });

  it("should reject non-string sortBy", async () => {
    const dto = new PaginationQueryDto();
    // @ts-expect-error: Testing invalid type
    dto.sortBy = 123;

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe("sortBy");
    expect(errors[0].constraints).toHaveProperty("isString");
  });
});