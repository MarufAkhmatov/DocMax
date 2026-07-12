export * from '@prisma/client';
export { PrismaClient } from '@prisma/client';
export { forOrg } from './tenant-client';
export { TENANT_SCOPED_MODELS, isTenantScopedModel, type TenantScopedModel } from './tenant-scope';
