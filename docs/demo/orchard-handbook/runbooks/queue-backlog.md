# Runbook: Queue Backlog

## Symptoms

The `queue_lag_seconds` alarm fires.

## Steps

1. Check whether a database failover is in progress; if so, wait for it to finish.
2. Otherwise restart the writer and watch the lag drain.
