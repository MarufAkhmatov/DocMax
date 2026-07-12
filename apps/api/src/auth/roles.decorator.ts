import { SetMetadata } from '@nestjs/common';
import type { Role } from '@docmax/shared';

export const ROLES_KEY = 'roles';

/** TZ-1 §1.1 ruxsat matritsasi: endpoint faqat shu rollarga ochiq (default: har qanday autentifikatsiyalangan). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
