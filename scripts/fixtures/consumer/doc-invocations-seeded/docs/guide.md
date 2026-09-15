# Guide

Write a report:

```text
cat > report.json <<'EOF'
{"rule": "no-empty"}
EOF
```

Then check it:

```text
tool check report.json
```

A report declaring no rule is refused:

```text
cat > empty.json <<'EOF'
{}
EOF
```

<!-- expect-exit: 4 -->
```text
tool verify empty.json
```

```text
tool: rule-missing: the report declares no rule
tool: run `tool verify` first
```
