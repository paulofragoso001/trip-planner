# Account-deletion request operations

Account deletion is an operator-managed request lifecycle, not an immediate self-service deletion endpoint. Authenticated users can create and read only their own request. The supported repository statuses remain `requested`, `in_review`, `completed`, and `cancelled`; `requested` is the product equivalent of pending. No broad admin endpoint is introduced in Phase 1.

## Ownership and processing

The designated privacy/support operator owns the queue. Before processing, the operator verifies the request belongs to the Auth identity, changes `requested` to `in_review` using a separately controlled administrative environment, records `reviewed_at` and `reviewed_by`, and contacts the verified account email if identity, scope, legal hold, or cancellation needs clarification. Operators must never accept identity changes or deletion authority from an unauthenticated message.

The operator inventories and removes or anonymizes, as applicable: Supabase Auth identity and sessions; `profiles`; owned trips and collaboration records; uploaded avatars and other owned storage objects; import/provider tokens and connection records; notification preferences and notifications; reservation documents; and user-identifying application data. Foreign-key behavior must be reviewed before deletion. Shared trip content must follow the product's ownership/collaboration rules rather than being indiscriminately removed.

Security, abuse-prevention, financial, and operational logs may be retained only for the documented legal or operational period and should be minimized or pseudonymized. A request record or separate restricted audit record may retain request ID, timestamps, status transitions, processor identity, deletion categories, retention exceptions, and the legal/operational basis—never access tokens, reset links, storage signatures, or provider credentials.

After all required systems are processed, the operator records completion and its timestamp before removing the Auth identity if the schema/process requires the request audit to survive. If `ON DELETE CASCADE` would remove the only completion evidence, export the minimal audit record to the approved restricted audit system first. A completed user normally cannot authenticate to view status; support may provide non-sensitive confirmation through the verified contact channel.

Cancellation is supported only while a request is `requested` and before destructive processing begins. The operator verifies the user, changes the status to `cancelled`, records the decision, and stops the runbook. Once `in_review`, cancellation is best-effort and must be assessed against work already performed. Duplicate open requests are not created.

## Deployment and rollback

Phase 1 does not add a privileged execution API and does not run any production deletion. Deploy application code before using the status UI. If the request presentation must be rolled back, revert the application commit; the existing request table and operator process remain compatible.
