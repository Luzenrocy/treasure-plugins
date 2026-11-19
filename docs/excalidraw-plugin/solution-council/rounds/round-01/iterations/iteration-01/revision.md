# Revision map

The following review findings were addressed in the same iteration before checker review:

| Finding | Change | Evidence |
|---|---|---|
| R-001 | Clarified direct `fetch` is conditional on host CSP; otherwise a host allow-list/proxy contract is required and is not an existing SDK API. | §5.2 and §11 O-003 |
| R-002 | Made exact internal placement a visual contract validated at desktop/mobile breakpoints, not a public API guarantee. | §4.1 and §10 |
| R-003 | Added package-owned namespace and collision policy for deterministic merge/removal. | §6.3 |
| R-004 | Scoped link hiding to enumerated visible targets and version-locked selectors; unknown links require fork decision. | §7.2 and §10 |
| R-005 | Replaced “建议 clamp” with a fixed design token and constrained small-viewport fallback. | §7.3 and §10 |
