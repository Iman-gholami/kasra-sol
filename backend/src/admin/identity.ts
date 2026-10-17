import type { FastifyReply, FastifyRequest } from 'fastify';
import { may, type Permission, type Role } from './permissions';

export type Identity = {
  id: string; username: string; display_name: string;
  role: Role; grants: Permission[]; revokes: Permission[]; active: boolean;
};
/** Sends 401/403 itself and resolves to null when the request may not proceed. */
export type Guard = (req: FastifyRequest, reply: FastifyReply, permission: Permission) => Promise<Identity | null>;

export const can = (user: Identity, permission: Permission) => may(user.role, user.grants, user.revokes, permission);
