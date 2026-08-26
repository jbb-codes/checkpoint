# SQLite for run/finding/event state, not flat files or in-memory only

Run state must survive a daemon crash-and-restart without losing track of what had already been validated, and must support filtered queries ("active runs", "gate history for a branch") natively. We chose a single embedded SQLite file over flat files (which would need hand-rolled search) or in-memory-only state (which loses everything on restart). The trade-off is a schema to maintain and migrate, accepted because query-ability and crash-survival are both hard requirements, not nice-to-haves.
