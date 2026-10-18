type Queryable = { query: (text: string, values?: unknown[]) => Promise<unknown> };

/** Append-only record of a privileged action. Pass the transaction client so the entry commits with the change.
 * Never put passwords, tokens or full customer addresses in `details`. */
export async function recordAudit(db: Queryable, actorId: string | null, action: string, target: string,
                                  details: object = {}) {
  await db.query('INSERT INTO admin_audit_log(actor_id,action,target,details) VALUES($1,$2,$3,$4::jsonb)',
    [actorId, action, target.slice(0, 120), JSON.stringify(details)]);
}
