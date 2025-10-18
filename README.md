📖 drizzle-crudA generic, opinionated, and highly extensible CRUD base repository/service for NestJS applications using Drizzle ORM and PostgreSQL.drizzle-crud abstracts away the boilerplate of standard database operations (create, read, update, delete) and provides advanced features like automatic soft-delete handling, robust uniqueness validation, and complex query building with pagination, sorting, and relation-based filtering—all through reusable generics.✨ FeaturesZero-Boilerplate CRUD: Inherit a single class to get all standard CRUD methods immediately.Automatic Uniqueness Checks: Specify unique fields in the DTO options (email, code, etc.) to get automatic 409 Conflict exceptions.Soft Delete Support: Handles deletedAt columns automatically across all queries (including findAll).Base Query Builder: Uses a dedicated BaseQueryBuilder class to handle dynamic Drizzle queries, including:Pagination and Sorting.Flexible filtering (using ilike for strings).Complex Relation-based filtering via Drizzle's exists subqueries.NestJS Integration: Built to work seamlessly with NestJS's dependency injection (ConfigService) and exception handling (ConflictException).🚀 InstallationThis is a peer dependency package. You must have NestJS, Drizzle, and a PostgreSQL driver installed.# Install the core Drizzle ORM package
npm install drizzle-orm

# Install the PostgreSQL driver (e.g., pg)
npm install pg

# Install this library
npm install drizzle-crud
Peer DependenciesEnsure these are installed in your main project:@nestjs/common@nestjs/configdrizzle-ormpg (or your chosen Drizzle driver)🛠️ ConfigurationThe package defaults to a pagination limit of 10 and offset of 0. You can easily override these values by importing and configuring the DrizzleCrudModule.Option 1: Using DrizzleCrudModule.forRoot() (Recommended)This allows you to pass specific values directly without affecting your global configuration.// app.module.ts (in your consuming project)
import { Module } from '@nestjs/common';
import { DrizzleCrudModule } from 'drizzle-crud/drizzle-crud.module'; 

@Module({
  imports: [
    DrizzleCrudModule.forRoot({
      pagination: {
        limit: 50, // Sets default limit for ALL repositories to 50
        offset: 0,
      }
    }),
    // ... other modules
  ],
})
export class AppModule {}
💡 Quick Usage ExampleCreate a custom repository/service that extends AbstractRepository.// users.repository.ts
import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AbstractRepository, DRIZZLE_DB_TOKEN } from 'drizzle-crud';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema'; // Your Drizzle schema object
import { users } from './schema'; // Your specific table definition

// Define DTOs/Entities (omitted for brevity)
interface UserEntity { /* ... */ }
interface CreateUserDto { email: string; name: string; }
interface FilterUserDto { email?: string; name?: string; limit?: number; }

@Injectable()
export class UsersRepository extends AbstractRepository<
  typeof users,
  UserEntity,
  CreateUserDto, // TCreateDto
  any, // TUpdateDto (use a real type)
  FilterUserDto, // TFilterDto
  typeof schema // TSchema
> {
  // Define which columns can be used for sorting and filtering
  protected readonly allowedSortColumns = ['name', 'email', 'createdAt'] as const;
  protected readonly allowedFilterColumns = ['name', 'email'] as const;

  constructor(
    @Inject(DRIZZLE_DB_TOKEN) db: NodePgDatabase<typeof schema>,
    configService: ConfigService,
  ) {
    // Pass the DB instance, table definition, schema, and any advanced options
    super(db, users, schema, configService, {
        relations: {
            // Define relation options for complex JOIN/EXIST filtering in findAll
            // e.g., allow searching 'roles' via user query
            roles: {
                tableName: 'roles', // The table key in the schema
                searchableColumns: ['name'],
                foreignKey: 'userId', 
            },
        },
    });
  }

  // Override create to enforce uniqueness checks
  async create(dto: CreateUserDto): Promise<UserEntity> {
    // Automatically checks if `email` already exists and throws ConflictException
    return super.create(dto, { uniqueFields: ['email'] });
  }

  // All other methods (findAll, findOne, update, delete) are inherited.
}
📦 PublishingFor instructions on compiling and publishing this package to the NPM registry, please refer to the PUBLISHING.md file.