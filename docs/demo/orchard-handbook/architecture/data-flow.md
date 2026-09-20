# Data Flow

Readings travel from the gateway through the queue to Postgres. During a failover the queue
absorbs the backlog until the writer reconnects.
