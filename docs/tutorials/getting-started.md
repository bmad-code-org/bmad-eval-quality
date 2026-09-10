---
title: "Start Here"
description: "Install eval-quality and compile a real eval contract in about five minutes."
sidebar:
  order: 1
---

# Start Here

Five minutes. You will install the binary, compile a real eval contract, and watch the compiler reject a broken one.

An **eval contract** is a JSON document that says what a system is supposed to do, written so an automated check can resolve it. The package ships twenty-four of them, so you do not have to write one yet.

## Before you start

Node.js 22.20.0 or newer. Nothing else.

## 1. Install it

```bash
npm install eval-quality
```

That puts a binary called `eval-quality` in the project and the shipped contracts under `node_modules/eval-quality/corpus/`.

Check that it answers:

```bash
npx eval-quality --version
```

It prints the version you installed.

## 2. Compile a contract

`compile` reads an authored contract, checks it against the contract schema, checks it against the discipline rules, and writes the compiled artifact.

```bash
npx eval-quality compile --in node_modules/eval-quality/corpus/dev/compile-seal-example/contract.json | head -c 200
```

The first 200 characters of what comes back:

```text
{"behaviors":[{"description":"A created thing is readable back in the list of things.","id":"B-001","observableSuccessCriterion":"A list call after a create returns one element per seeded thing, carry
```

That contract declares one behavior: *a created thing is readable back in the list of things*. Its checks look at the create response **and** at the list that create was supposed to change. An evaluation that only read the create response would pass while the list stayed empty. That is the shape of blind spot the whole tool exists to find.

The artifact itself is one line of JSON with the keys in sorted order, plus a trailing newline. The digest, a fingerprint of the artifact, is computed over that line without the newline, so two machines agree on what the contract is.

The command exited `0` and wrote to stdout. Add `--out` to land the artifact on disk:

```bash
npx eval-quality compile --in node_modules/eval-quality/corpus/dev/compile-seal-example/contract.json --out ./compiled
```

An `--out` value ending in `.json` is a file path. Anything else is a directory, and the file inside it is named after the artifact kind.

## 3. Watch it reject one

`compile` is a type checker for your eval design. A contract can be valid JSON, match the schema, and still be incapable of proving anything, and `compile` rejects the cases it has a rule for.

The corpus ships three contracts that fail on purpose. This one lets an operation take an input and never establishes that the operation reads it:

<!-- expect-exit: 4 -->

```bash
npx eval-quality compile --in node_modules/eval-quality/corpus/dev/contracts/no-state-change-marker.json
```

```text
eval-quality: undeclared-mandatory-input: EvalContract.permittedInterfaces[0].operations[0]: operation "create-thing" declares request keys but no sensitivity witness; ...
```

Exit code `4`. The message names a machine-readable failure code, `undeclared-mandatory-input`, and the exact path inside the contract that broke the rule.

A check over that operation would pass while the input was ignored entirely, so the pass would be worth nothing. Catching that at compile time costs one second. Catching it by running a full evaluation twice costs a great deal more.

## What you just did, and what comes next

You compiled a contract and read a rejection. Those are the two things `compile` is for.

You have not run an evaluation. Nothing in this package does: no agent, no judge, and no system under test executes inside it. Running the system and the evaluator is your harness's job, and `eval-quality` handles the artifacts on either side of that.

- **[How it works](/explanation/behavioral-evaluation-contracts/)** is the next page. It explains the twin run, what an eval contract declares, and why the rejection above is worth having.
- **[The full walkthrough](/how-to/author-behavioral-contracts/)** runs all four commands end to end and reads a real scored run down to its verdict.
