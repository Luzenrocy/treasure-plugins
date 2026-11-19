# Review findings

Reviewer role: isolated review pass, ledger version 1, contract hybrid technical design.

- id: R-001
  severity: P1
  category: source
  location: "§5.2 LibrarySource / Assumption A-001"
  evidence: "Treasure SDK sources list files, directories, storage, settings, permissions, but no public network module; the draft allows browser fetch as an assumption."
  impact: "A reader could implement a direct network call that fails under Treasure CSP or exceeds the documented SDK boundary."
  action: "Make the network transport an explicit adapter decision: direct fetch only when host CSP allows it; otherwise require a host allow-list/proxy contract. Do not present either as an existing SDK capability."
  acceptance_check: "The final scheme marks transport as an open integration dependency and defines the failure/blocked state."
  status: open
- id: R-002
  severity: P2
  category: ambiguity
  location: "§4.1 renderTopRightUI"
  evidence: "The requirement names an internal top-right wrapper, while renderTopRightUI is a public slot whose exact alignment can differ by Excalidraw version."
  impact: "The proposed button may not visually occupy the requested location on mobile or after an upstream layout change."
  action: "State that placement is a visual contract validated at desktop/mobile breakpoints; do not promise exact internal DOM placement."
  acceptance_check: "A layout check covers both breakpoints and verifies no overlap with native controls."
  status: open
- id: R-003
  severity: P2
  category: consistency
  location: "§6.3 updateLibrary"
  evidence: "The draft says merge installed LibraryItems but does not define duplicate-id/version collision behavior."
  impact: "Installing a package could duplicate or overwrite user-created library items unpredictably."
  action: "Define collision policy: package id/version controls installed entries; user-created items are preserved; reinstall replaces only the package-owned namespace."
  acceptance_check: "The model and state transition specify deterministic merge/removal behavior."
  status: open
- id: R-004
  severity: P2
  category: ambiguity
  location: "§7.2 Excalidraw links"
  evidence: "‘Excalidraw links’ is a user phrase, not a stable UIOptions field; the draft only says CSS compatibility layer."
  impact: "Implementation may hide unrelated links or claim unsupported public control."
  action: "Define the target as only the visible menu/link entries requested by product, with selectors version-locked and no guarantee for hidden internal routes; any unhideable entry is an explicit fork decision."
  acceptance_check: "No public API claim is made for link hiding and DOM contract tests enumerate the exact targets."
  status: open
- id: R-005
  severity: P2
  category: acceptance
  location: "§7.3 fixed-height list"
  evidence: "The draft says ‘建议使用 CSS clamp’ even though the requirement requires fixed height."
  impact: "A UI implementation could use an unbounded or page-level list and regress the reported overlapping/blank-space problems."
  action: "Specify a design token for a fixed list height, with only a constrained small-viewport fallback, and keep the list as the sole scrolling region."
  acceptance_check: "The final scheme names the token and its overflow rule."
  status: open
