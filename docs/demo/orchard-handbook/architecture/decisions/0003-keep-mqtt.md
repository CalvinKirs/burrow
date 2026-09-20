# ADR 0003: Keep MQTT for gateways

## Status

Accepted.

## Decision

Gateways are on flaky links; MQTT's session resumption beats anything we would build on HTTP.
