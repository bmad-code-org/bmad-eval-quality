---
title: "How to Score Defects and Contracts"
description: "Calculate contract strength and measure defect detection effectiveness across evaluation corpora."
sidebar:
  order: 2
---

# How to Score Defects and Contracts

`eval-quality` measures the mathematical strength of evaluation contracts by testing them against known defect suites.

---

## Defect Suite Evaluation

Run defect scoring across your corpus:

```bash
npx eval-quality eval --corpus ./corpus/dev-corpus.json
```

---

## Understanding Contract Strength

Contract strength \(S\) is computed as the ratio of detected defects to total corpus defects, weighted by predicate specificity:

\[
S = \frac{\sum_{i=1}^{N} w_i \cdot d_i}{N}
\]

where \(w_i\) represents the predicate weight and \(d_i \in \{0, 1\}\) indicates whether defect \(i\) was caught by the contract oracle.

---

## Validating Corpus Coverage

Run the corpus check command:

```bash
npm run check:corpus
```

This verifies that all known defect vectors are covered by active contract predicates.
