- source_spec: `_bmad-output/implementation-artifacts/spec-condense-readme.md`
  summary: Make shareable evidence links usable for unauthenticated recipients while the repository is private.
  evidence: The generated HTML is self-contained for the four companion documents, while evidence, contribution, security, and license links require access to the private GitHub repository.

- source_spec: `_bmad-output/implementation-artifacts/spec-condense-readme.md`
  summary: Add validation that shareable HTML is current and contains the canonical repository URL.
  evidence: The current documentation check excludes generated shareable HTML, so stale exports or legacy repository URLs can pass validation.
