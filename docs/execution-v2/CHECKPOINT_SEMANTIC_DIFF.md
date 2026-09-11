# Checkpoint semantic mismatch: exact evidence

Before read operation: `10028d97f7a5574bce565c5c55b879f0`.
After read operation: `7a127839c06806b507f0a97f5cc6f6e5`.
Reload operation: `aaac2a988cdde9e2a8e633cc7992a519`.

Complete semantic diff (components and nets):

```json
[{"path":"/components/2/uniqueId","before":"","after":"gge4"}]
```

The component is RQUAL3, primitive `ed2be78e1e576a89`. Component count/order, primitive identity, source footprint/supplier, pose, designator, pins, pin nets and net inventory are identical. No other semantic difference exists in the captured pair. Raw receipt before/after and full diff are retained in [evidence](evidence/checkpoint-semantic-20260911/).

SOURCE FACT: the same primitive acquired a nonempty uniqueId after persistence/reload. No previous nonempty identity disappeared in this evidence.

The minimal comparison change permits only explicit empty-string uniqueId on a schematic part to become a nonempty unique value, with the same primitive and every other field/collection unchanged. It records the transition in checkpoint output. Missing/null IDs, changed existing IDs, duplicate primitive/unique IDs, coordinate/net changes and lost objects still fail. It does not erase IDs or generally normalize ordering/defaults. Raw before/after evidence is never mutated.

Only CLI checkpoint comparison changed. Four Outcomes, coordinator, target/recovery and mutation admission are unchanged. No Host mutation occurs in comparison or reconciliation.
