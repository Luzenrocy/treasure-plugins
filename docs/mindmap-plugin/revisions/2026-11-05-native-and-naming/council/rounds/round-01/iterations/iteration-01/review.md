# Independent review — round 01, iteration 01

- Role: reviewer; fresh context, shared files and listed sources only.
- Ledger checked: version 1, U-001–U-006, every hard requirement.
- Contract checked: `native-and-naming-v1`, version 1.
- Rules checked: `writing-workshop-20261105-r1i1`; all 12 listed paths, modification times and SHA-256 values match the current files. No reload required.
- Input identity: hashes of the brief, ledger, contract, source index and rules snapshot match `input-snapshot.yaml`.
- Quality lenses: decision record for meaningful alternatives and recommendation; normative review for file lifecycle; reference review for name/suffix/slug mappings.

**No findings.**

## Requirement and evidence checks

| Requirement | Draft location | Independent review result |
| --- | --- | --- |
| U-001 | Lines 18–40, 130–141 | SMM/Xmind have the same input-only, read-only boundary. First modification requires an independent native copy; new, single/multiple-sheet, save, cancel, conversion failure and write failure paths are covered. Former SMM in-place editing and the second-sheet gate are explicitly superseded. Simulation is separated from real parsing and persistence. |
| U-002 | Lines 44–51, 57–101 | 石玉录 and 考成策 preserve the user's stated rationales. Each new name follows a meaningful concept, modern product interpretation and explained carrier word. No decorative word assembly is presented as historical fact. |
| U-003 | Lines 55–101, 120–124 | Six distinct candidates each explain meaning, product fit, benefit and tradeoff. The ranking is clear; 会通图 is a recommendation, with selection reserved to the user. |
| U-004 | Lines 103–116, 124–126 | All six names have lowercase ASCII suffixes derived from their core words, full-name pinyin slugs and concrete single/multiple-sheet examples using one native format. Suffix choice is distinguished from schema completion. |
| U-005 | Lines 57–99 | All short quotations match the verified passages recorded in S-004–S-007. Historical contexts are stated separately from modern interpretations; constructed full names and the reconstructed 纲目图 are expressly identified. No invented ancient software meaning or quotation appears. |
| U-006 | Metadata; lines 18–22, 116, 124–126, 139 | Candidate status is prominent. No final name, suffix, uniqueness or trademark clearance is claimed. `.treasuremind` remains a historical placeholder. The amendment identifies its precedence and links the preserved historical proposal. |

## Other dimensions checked

- Scope, audience and tone: concise Chinese decision material for product and engineering readers; no unrelated technology selection or generic PRD expansion.
- Source fidelity: user naming intent remains authoritative; classical quotations use the source index's verified primary-text record. The prototype limitations agree with S-003. No broader external clearance or historical certainty is implied.
- Clarity and operational risk: viewing does not alter the source; editing, conversion, native saving and static export remain distinguishable. Failure cannot be reported as a successful save.
- Format and path: required frontmatter and all six contract sections are present. Both local links resolve from the declared publication location. The draft is clean and independently readable.
- Coverage: `coverage.yaml` accounts for all six hard entries without an omitted or conflicting requirement.

Review scope is the proposed document and its shared evidence. The checker retains responsibility for final publication, repository-diff preservation checks and the final AI decision; this review neither selects a product name nor verifies implementation completion.

Ready for checker.
