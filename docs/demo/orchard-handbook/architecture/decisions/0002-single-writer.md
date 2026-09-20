# ADR 0002: One writer per partition

## Status

Accepted.

## Decision

A single writer keeps ordering simple. Throughput is bounded by `COPY`, which is plenty.
