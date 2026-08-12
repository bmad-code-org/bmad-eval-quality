- source_spec: `_bmad-output/implementation-artifacts/spec-condense-readme.md`
  summary: Make shareable evidence links usable for unauthenticated recipients while the repository is private.
  evidence: The generated HTML is self-contained for the four companion documents, while evidence, contribution, security, and license links require access to the private GitHub repository.

- source_spec: `_bmad-output/implementation-artifacts/spec-condense-readme.md`
  summary: Add validation that shareable HTML is current and contains the canonical repository URL.
  evidence: The current documentation check excludes generated shareable HTML, so stale exports or legacy repository URLs can pass validation.

- source_spec: `_bmad-output/implementation-artifacts/1-2-canonical-digest-computation-and-the-hashed-artifact-value-domain.md`
  summary: Measure digest-path throughput over large observation/score arrays and decide whether the per-property descriptor allocation in the fused canonicalizer needs optimization.
  evidence: Code review round 2 (2026-08-11) noted the canonical digest path allocates a descriptor object per property with no measurement; the fused single-pass serializer already halved traversals, and no NFR binds digest throughput before Epic 6, so measurement was deferred rather than optimized blind.
