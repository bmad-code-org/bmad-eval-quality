---
title: "Author a Behavioral Evaluation Contract"
description: "Write a contract against the published EvalContract schema, compile it, and read the failure when compile rejects it."
sidebar:
  order: 1
---

# Author a Behavioral Evaluation Contract

A contract is a JSON document. `schemas/eval-contract.schema.json` is the normative shape, published under `$id: urn:eval-quality:schema:eval-contract`. This page shows what that document requires and how to check an authored contract against it.

---

## Start from a contract that already compiles

`corpus/dev/contracts/satisfied-declarations.json` is the worked example. It declares one behavior, seven oracles, one interface with two operations, and a four-step interaction plan, and `compile` accepts it:

```bash
node dist/cli/main.js compile --in corpus/dev/contracts/satisfied-declarations.json > /dev/null
echo "exit $?"
```

```text
exit 0
```

The same bytes ship a second time as `corpus/dev/compile-seal-example/contract.json`, next to the sealed brief they produce.

---

## The required fields

The schema sets `additionalProperties: false` and requires twenty-one top-level fields. An absent field and an unrecognized field both fail the parse, so a contract carries all twenty-one, using `null` or an empty collection where it has nothing to say.

**Identity and lineage**

`schemaVersion`, `contractId`, `parentDigest`, `revisionCount`, `sourceSpecDigest`

**What is under evaluation**

`behaviors`, `oracles`, `rubrics`, `waivers`

**The surface a probe may touch**

`permittedInterfaces`, `siblingGroups`, `interactionPlan`, `scopedResources`, `forbiddenInputs`

**Data the checks read**

`referenceSets`, `testData`

**Bounds on a run**

`budgets`, `safetyLimits`, `probeStepBound`

**Evidence and fixture handling**

`requiredEvidence`, `fixtureReset`

For the type of each field, its value space, and every nested shape, read `schemas/eval-contract.schema.json`. It is the normative document, and the descriptions inside it carry the reasoning for each constraint. The remaining eleven schemas in `schemas/` cover the other artifacts, including `probe.schema.json`, `preflight-verdict.schema.json`, and `sealed-evaluator-brief.schema.json`.

---

## Read the schema from a consumer

The schemas are published at the `eval-quality/schemas/*` export subpath, so a consumer reaches them by specifier without knowing the install layout:

```javascript
import spec from 'eval-quality/schemas/eval-contract.schema.json' with { type: 'json' }

console.log(spec.$id, spec.required.length)
```

The `with { type: 'json' }` attribute is mandatory. Node 22 and Node 24 both throw `ERR_IMPORT_ATTRIBUTE_MISSING` on an ESM JSON import without it.

---

## Compile rejects more than the schema does

Passing the schema is the first gate. `compile` then checks the contract against the discipline rules, and those rejections carry their own failure codes. Two examples ship in the corpus.

An operation that declares request keys and no sensitivity witness:

```bash
node dist/cli/main.js compile --in corpus/dev/contracts/no-state-change-marker.json > /dev/null
```

```text
eval-quality: undeclared-mandatory-input: EvalContract.permittedInterfaces[0].operations[0]: operation "create-thing" declares request keys but no sensitivity witness; only an operation declaring no keys in any channel is exempt (AD-10)
```

An oracle addressing a request field the operation never declares:

```bash
node dist/cli/main.js compile --in corpus/dev/contracts/empty-request-shapes.json > /dev/null
```

```text
eval-quality: unreachable-check-evidence: EvalContract.oracles[id=O-005].check.operands[0].operands[0]: "/interactions/create/call-inputs/body/name" addresses call-inputs body field "name", which operation "create-thing" declares in neither requiredKeys nor permittedKeys
```

Both exit `4`, the structural-failure code. The message names the failure code, the path inside the artifact, and what was wrong at that path.

---

## Use the corpus as a rule index

`corpus/dev/contracts/` holds nineteen contracts, one per discipline rule in each declaration state. Sixteen compile, and three fail by design. `corpus/dev/index.json` lists every file with its digest, and records the failure code for each of the three that fail:

```bash
node -e "for (const e of require('./corpus/dev/index.json').entries) if (e.structuralFailure) console.log(e.structuralFailure, e.path)"
```

```text
unreachable-check-evidence corpus/dev/contracts/empty-request-shapes.json
unreachable-check-evidence corpus/dev/contracts/no-operation-inventory.json
undeclared-mandatory-input corpus/dev/contracts/no-state-change-marker.json
```

When a rule is unclear, open the contract named after it and the one next to it that satisfies it. `corpus/dev/README.md` explains what the corpus covers and what it deliberately leaves out.

---

## Check the repository's own copies

Two repository scripts keep the published schemas and the corpus honest against the source:

```bash
npm run check:schemas
npm run check:corpus
```

---

## Related pages

- [Run the three commands](/how-to/run-the-three-commands/)
- [CLI reference](/reference/cli-commands/)
- [What a Behavioral Evaluation Contract asserts](/explanation/behavioral-evaluation-contracts/)
