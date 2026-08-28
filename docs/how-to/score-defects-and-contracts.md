---
title: "How to Score Defects and Contracts"
description: "Calculate contract strength and measure defect detection probability across evaluation corpora."
sidebar:
  order: 2
---

# How to Score Defects and Contracts

`eval-quality` evaluates contract strength against known defect suites.

---

## Defect Suite Evaluation

Run defect scoring over a trace corpus:

```bash
npx eval-quality eval --corpus ./corpus/dev-corpus.json
```

---

## Contract Strength Formula

Contract strength \(S\) is computed as the ratio of caught defects to total corpus defects, weighted by predicate specificity:

\[
S = \frac{\sum_{i=1}^{N} w_i \cdot d_i}{N}
\]

where \(w_i\) is the predicate weight and \(d_i \in \{0, 1\}\) indicates whether defect \(i\) was caught by the oracle.

---

## Validating Corpus Coverage

Verify active contract predicates cover all committed defect vectors:

```bash
npm run check:corpus
```
