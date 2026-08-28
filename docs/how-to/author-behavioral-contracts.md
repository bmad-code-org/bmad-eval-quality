---
title: "How to Author Behavioral Contracts"
description: "Learn how to define, validate, and compile behavioral evaluation contracts for agent outputs and execution traces."
sidebar:
  order: 1
---

# How to Author Behavioral Contracts

Behavioral Evaluation Contracts define strict expectations over agent execution traces. This guide covers authoring contracts using Zod schemas and predicate predicates.

---

## Contract Schema Structure

Contracts consist of four primary sections:

1. **Metadata**: Unique identifier, version, and ownership lineage.
2. **Preconditions**: States that must hold prior to step execution.
3. **Postconditions**: Invariants that must be satisfied after step execution.
4. **Behavioral Oracles**: Predicates that evaluate domain correctness.

```typescript
import { z } from 'zod';

export const BehavioralContractSchema = z.object({
  id: z.string(),
  version: z.string(),
  preconditions: z.array(z.string()),
  postconditions: z.array(z.string()),
  predicates: z.record(z.string(), z.any()),
});
```

---

## Authoring Custom Predicates

Predicates map trace step attributes to boolean assertions. 

```typescript
export const CheckNonEmptyOutput = (traceStep: any): boolean => {
  return typeof traceStep.output === 'string' && traceStep.output.trim().length > 0;
};
```

---

## Validating Contract Registries

Validate that your authored contract conforms to registry requirements:

```bash
npm run check:schemas
npm run check:ad31-table
```

---

## Related Guides

- [Score Defects and Contracts](/how-to/score-defects-and-contracts/)
- [Behavioral Evaluation Contracts Deep Dive](/explanation/behavioral-evaluation-contracts/)
