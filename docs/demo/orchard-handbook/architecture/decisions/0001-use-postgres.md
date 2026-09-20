# ADR 0001: Use Postgres for time series

## Status

Accepted.

## Decision

We store readings in Postgres with time partitioning instead of a dedicated time series database.
Failover behaviour is well understood by the team.
