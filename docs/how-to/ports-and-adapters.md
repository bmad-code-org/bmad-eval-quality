---
title: "Ports, Adapters, and the Conformance Suite"
description: "Supply your own effects, and prove your implementation conforms before you trust it."
sidebar:
  order: 3
---

# Ports, adapters, and the conformance suite

`eval-quality` performs no effects of its own. A port is an interface the package declares for an effect it will not perform; an adapter is your implementation of one. `eval-quality/adapters` ships three reference adapters, and `eval-quality/conformance` ships the suite that decides whether an implementation conforms.

One port is wired to a stage today. `preflight` reaches a live environment through `EnvironmentProbePort`, and that is the only place in the shipped path where a port is awaited. The other three are declared, published, and unused by the package itself: the CLI reads and writes artifacts with `node:fs/promises` directly. They are here for the stages that will use them and for a caller building its own pipeline on the library.

## The four ports

| Port | What it does | Wired today |
| --- | --- | --- |
| `EnvironmentProbePort` | Probes a live environment | Yes. `preflight` awaits it |
| `ClockPort` | Reads the current time | No |
| `CorpusPort` | Resolves an opaque private reference to bytes | No. Intended for the private artifacts a contract points at |
| `FileSystemPort` | Reads and writes files | No. The CLI uses `node:fs/promises` |

Each port's type comes from `eval-quality/conformance`:

```ts
import type { CorpusPort, EnvironmentProbePort } from 'eval-quality/conformance'
```

## The three reference adapters

```ts
import {
  createLocalCorpusAdapter,
  createNodeFileSystemAdapter,
  createSystemClockAdapter,
} from 'eval-quality/adapters'
```

Each is a factory taking the mechanism it wraps, so a test can substitute one without a filesystem or a clock. The architecture calls them conveniences, and the package works without them. There is no reference `EnvironmentProbePort`, because probing a live environment is the part only the adopter can write.

## Running the conformance suite

The suite checks behavior the type checker cannot: whether the implementation returns a typed fault where the boundary demands one, and whether it hangs where it should time out.

It does not take your port. It takes a `PortSubject`, which is a small harness around your port that the suite drives. You supply a name, one sample request, and a `build` function the suite calls once per scenario. `ScenarioKind` is the four situations it needs your port to be in: `resolves`, `fails`, `in-band-error`, and `hangs`. Putting the port into each of them is your job, because only you know how to make your mechanism fail.

```ts
import {
  runCorpusPortConformance,
  formatConformanceReport,
  type PortSubject,
  type ScenarioKind,
} from 'eval-quality/conformance'

const subject: PortSubject<{ privateRef: string }> = {
  name: 'my-corpus-adapter',
  sampleRequest: { privateRef: 'ref-1' },
  build: async (scenario: ScenarioKind) => {
    let calls = 0
    return {
      port: async (request, signal) => {
        calls += 1
        return myMechanism(request, signal, scenario)
      },
      underlyingCalls: () => calls,
    }
  },
}

const report = await runCorpusPortConformance(subject)
console.log(formatConformanceReport(report))
if (!report.passed) process.exitCode = 1
```

`build` returns a fresh instance every time, and `underlyingCalls` counts the underlying mechanism rather than the port call, or the retry assertion counts the wrong thing and passes for everything.

There is one runner per port: `runClockPortConformance`, `runCorpusPortConformance`, `runFileSystemPortConformance`, and `runEnvironmentProbePortConformance`.

A report carries `subject` (the name you gave), `port`, one outcome per assertion, and a `passed` field over all of them. Every outcome has an id of the form `<method>/<assertion>`, so a failure names the method and the property it broke.

## How many assertions to expect

`CONFORMANCE_OUTCOME_COUNTS` publishes the count per port, and the suite asserts its own totals against it:

| Port | Outcomes |
| --- | --- |
| `corpus` | 6 |
| `clock` | 6 |
| `file-system` | 12 |
| `environment-probe` | 19 |

Six assertions per port method: one per scenario above, plus two over the fault's type and its artifact path. The environment probe carries thirteen more, from the default-deny target policy that keeps a probe from reaching anything the caller did not authorize.

A count that does not match means the suite did not finish, which is itself a failure. Read the outcome list.

In this repository:

```bash
npm run test:conformance
```

That runs every published runner against the three shipped adapters and against an in-repository probe subject, which exists so the environment-probe runner has something to exercise without a live system.
