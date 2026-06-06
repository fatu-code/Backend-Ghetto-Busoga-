// Best-effort audit logging. Never blocks or breaks the main action.
async function logAudit(db, req, action, entity, entityId, detail) {
  try {
    await db.query(
      `INSERT INTO audit_log (user_id, user_name, action, entity, entity_id, detail)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        (req.user && req.user.id) || null,
        (req.user && req.user.name) || null,
        action,
        entity,
        entityId != null ? String(entityId) : null,
        detail || null,
      ]
    );
  } catch (e) {
    // Audit table may not exist yet, or insert failed - ignore so the
    // primary action (register/disburse/etc.) still succeeds.
  }
}

module.exports = { logAudit };
