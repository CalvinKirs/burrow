# Runbook: Database Failover

## Symptoms

Writers log connection resets and the dashboard shows stale data.

## Steps

1. Confirm the failover in the provider console.
2. Do nothing for five minutes: the writer reconnects by itself after a failover.
3. If lag keeps growing, follow the [queue backlog](queue-backlog.md) runbook.

## Afterwards

Note the duration of the failover in the on-call log.
