// Jest-compatible re-export of @repo/shared for the API test suite.
// The package barrel (src/index.js) uses ESM syntax with explicit .ts extension
// references that are incompatible with ts-jest under the API tsconfig
// (moduleResolution: node, no allowJs). Each import below targets the TypeScript
// source file directly, bypassing the barrel entirely.
export * from '../../../../packages/shared/src/enums/board-permission.enum';
export * from '../../../../packages/shared/src/enums/workspace-permission.enum';
export * from '../../../../packages/shared/src/enums/user-status.enum';
export * from '../../../../packages/shared/src/enums/user-roles.enum';
export * from '../../../../packages/shared/src/enums/assets-visibility.enum';
export * from '../../../../packages/shared/src/enums/activity-logs.enum';
export * from '../../../../packages/shared/src/schemas/login.schema';
export * from '../../../../packages/shared/src/types/board.types';
export * from '../../../../packages/shared/src/types/workspace.types';
