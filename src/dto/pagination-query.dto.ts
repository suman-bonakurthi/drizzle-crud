import { IsIn, IsOptional, IsPositive, IsString, Min } from "class-validator";

export class PaginationQueryDto {
	@IsOptional()
	@IsPositive()
	limit?: number;

	@IsOptional()
	@Min(0)
	offset?: number;

	// New: Field to sort by. Restrict to valid columns for safety.
	@IsOptional()
	@IsString()
	sortBy?: string;

	// New: Sort direction.
	@IsOptional()
	@IsIn(["asc", "desc"])
	order?: "asc" | "desc";
}
