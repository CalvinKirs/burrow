# API: Rate Limits

Each gateway may send 10 batches per second. Excess requests get `429` with `Retry-After`.
