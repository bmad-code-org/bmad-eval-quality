# Learning path template

Rules for adding a step to `learning-path-step-by-step.md`. Add a step only after a story's
dev-story workflow marks it done, so the file never describes code that does not exist.

## Shape

Every step uses exactly these headings, in this order:

```text
## Step N: title

**What:** one or two lines.
**Why:** two to four lines. What breaks if this did not exist.
**Rules:** up to nine bullets, one or two lines each. No paragraphs.
**Read in this order:** numbered file paths, one line each, saying what the file does.
**Watch out:** optional. Repo state that will confuse a reader.
**Story:** the implementation-artifact path.
mermaid diagram
```

Then add one row to the table at the top of the file.

## Writing rules

Write it the way you would say it out loud to someone at a whiteboard.

- Short words. Say "read raw text" and not "lexical pre-parse". Jargon only when it is the name of
  a thing in the code, like a fault code or a file path.
- One idea per bullet, and no bullet longer than two lines. If it needs a paragraph, the paragraph
  belongs in a code comment and the bullet just points at the file.
- Say the problem in real terms. "JavaScript loses digits above 2^53" beats "the numeric value
  domain is enforced in two layers".
- Keep exact paths, numbers, fault codes, and security rules as they are.
- Name code points (U+FB33), never paste the character. Tools silently rewrite pasted glyphs.
- No em dashes or ` - ` joining clauses. Use a period, colon, or semicolon.
- Do not repeat in words what the diagram already shows.

## Duplication to avoid

- Do not add a separate owner map. This repo carries no `Story X Task Y step Z owner` anchors in
  source, so an owner map only repeats the read list.
- Do not add `Searchable strings:` or `Pattern summary:` sections.
- Do not repeat a rule in both `Why` and `Rules that hold`.

## Mermaid

Open with three backticks plus `mermaid`, close with three backticks, close each diagram before the
next heading, and render it after editing.
