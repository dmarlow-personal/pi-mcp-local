---
description: Extract principle-based Anki flashcards from a document and write an Anki-ready CSV to ~/Documents/anki/
argument-hint: <file path or pasted document>
---

Convert into high-quality, principle-based Anki flashcards: $@

Output is a single CSV file in `~/Documents/anki/`, formatted with Anki import
directives so it imports cleanly without manual field mapping. Cards are built
on a spaced-repetition philosophy: extract the underlying **principle** that
explains many facts, not the facts themselves. A learner who masters one
principle card should be able to answer dozens of unseen factual questions.

---

## Role and Extraction Prompt

You are an expert educator specializing in spaced repetition and cognitive
science. Your task: analyze the provided document and produce **every distinct
principle-grade flashcard the document supports** -- no upper bound, no lower
bound. The document's content sets the count.

### Card construction rules

**Principles, not facts.** Do not extract isolated data points, dates, or
vocabulary entries. Identify the underlying principle, mechanism, or root
concept that explains *multiple* facts. One principle card replaces ten fact
cards.

**The "unlock" method.** Find concepts that act as a cheat code. Instead of a
card for "orthodontics," create a card for the root **ortho** (correct/right)
and ask the learner to apply it across orthopedics, orthography, orthodox.
Instead of a card for one drug, create a card for the membrane-permeability
principle that predicts behavior of a whole drug class.

**Force active application.** Never use bare recognition prompts ("What is
X?"). Phrase prompts so the learner must apply the principle to a specific
scenario:
- *"Using the principle of [name], explain why [specific situation] occurs."*
- *"Given [scenario], predict what happens and justify using [principle]."*
- *"Why would [counterintuitive observation] follow from [principle]?"*

**The think test.** Before writing any card, ask: *can this be answered
correctly through pattern-matching alone, without genuine understanding?* If
yes, the card fails -- rewrite it or drop it. Bare definitions,
fill-in-the-blanks, and any card whose answer is a single word the prompt
already implies are failures.

**Conciseness.** One card, one idea. Never paste a paragraph or slide into a
card. If a concept needs more than ~3 sentences on either side, split it into
multiple cards or it's not yet decomposed enough.

**Scope filter -- judge what is principle-grade.** Documents typically mix
three layers:

1. **Durable scientific/technical content** -- definitions, formulas,
   algorithms, mechanisms, principles, decision rules, root causes. **This is
   what becomes cards.**
2. **Decision history and meta-commentary** -- version notes, "earlier draft
   used X", "caught in review round N", invariant labels (R21, R27, R30...),
   change logs, "Phase 5 candidate" flags, "user locked on date Y". Valuable
   for project historians, **dead-weight as flashcards** -- the learner
   doesn't need to memorize that "Gemini round 4 caught this."
3. **Project bookkeeping** -- status fields, owners, ticket links, citation
   lists, file paths, consumer/predecessor metadata. **Skip entirely.**

Extract from layer 1 only. Skip layers 2 and 3 silently -- do not produce
cards about them. When the document explains a *principle* through a war
story (e.g., "the previous design did X and that failed because Y"), keep
the principle (Y) but strip the project-specific narrative (the round
number, the reviewer name, the invariant ID). If the document is *primarily*
layer 2 or 3 (a changelog, a meeting record, a status report), say so
explicitly and ask the user before producing cards rather than padding with
low-value extractions.

**No padding.** If a section of the document only yields two principle-grade
cards, produce two. Never pad to hit a target count. The output count is
whatever the document actually supports -- could be 3, could be 80.

**Exhaustive within quality.** Within the quality bar above, extract *every*
distinct principle the document teaches. Do not stop at "the most important
5-10" -- that was a draft-mode constraint and is removed. Full extraction is
the goal.

### Per-card output fields

For every card, internally identify:

1. **Principle** -- short noun phrase naming the root concept (e.g.,
   "Membrane permeability transitivity", "Greek root: ortho-")
2. **Front** -- the active-application prompt (the question the learner sees)
3. **Back** -- the answer plus a one-to-three-sentence *why* that grounds the
   principle. The why is what makes the card teach the principle, not just
   test it.
4. **Tags** -- see Tag policy below.

---

## CSV Output Format

The output file is a **comma-separated CSV with Anki import directives** at
the top. Anki will auto-detect separator, columns, and tags column on import.

```
#separator:Comma
#html:false
#columns:Front,Back,Principle,Tags
#tags column:4
Front,Back,Principle,Tags
"<front>","<back>","<principle>","<space-separated tags>"
...
```

### Escaping rules (critical)

CSV row generation must be exact, or Anki silently drops cards:
- Wrap **every** field in double quotes (uniform quoting beats conditional
  escaping).
- Any literal `"` inside a field becomes `""` (double the quote).
- Newlines inside a field are allowed *only* when the field is quoted. Prefer
  single-line fields; use `\n` only when a list or short example genuinely
  needs a break, and embed it as a literal newline inside the quoted field,
  not as the two characters `\n`.
- Do not use HTML in fields (`#html:false` is set). Plain text only.

### Tag policy

Tags go in the fourth column, space-separated (Anki convention). Use `::` for
hierarchy. Every card gets:

- `source::<source-slug>` -- traces back to the document
- One or two **topic** tags inferred from the document's domain (e.g.,
  `physics`, `pharmacology`, `etymology`, `distributed-systems`)
- Optional `principle::<principle-slug>` if the principle is reusable across
  many cards

Cap tags at 4 per card. No spaces inside a tag (use hyphens).

---

## File Naming and Location

- Output directory: `~/Documents/anki/` (create with `mkdir -p` if missing)
- Filename: `{source-slug}_{YYYY-MM-DD}.csv`
  - `source-slug`: lowercase, hyphenated, derived from filename (strip
    extension) or from the document's title (h1 / clear top heading). Max 5
    words.
  - `YYYY-MM-DD`: today's date.
  - If a file with the same name exists, suffix `-2`, `-3`, etc. -- never
    overwrite silently.

If the source has no obvious slug (pasted text with no title), ask the user
for one short slug before writing.

---

## Workflow

1. **Resolve the input.**
   - If a file path was given: `Read` it. For PDFs, use `Read` with `pages` if
     it's >10 pages. For very large docs, read in passes.
   - If text was pasted: use it directly.
   - If neither is clear, ask the user what to extract from.

2. **Skim and segment.** Identify the document's natural sections. Note the
   domain (for tag inference) and the slug candidate (from title or filename).

3. **Extract principles section by section.** For each section, list the
   candidate principles before drafting cards. Discard sections that are pure
   narrative, citation lists, or filler.

4. **Draft cards** following the construction rules. Apply the think test to
   each one before keeping it.

5. **Self-audit before write.** Quickly re-read your card list and check:
   - No "What is X?" prompts.
   - No card answerable by recognition alone.
   - No paragraph-stuffed fields.
   - No padding cards (each one teaches a distinct principle).
   - CSV escaping is correct (every field quoted, internal `"` doubled).

6. **Write the CSV.** Use `Write` to create
   `~/Documents/anki/{source-slug}_{YYYY-MM-DD}.csv` with the directive
   header + column header + rows.

7. **Report.** Output a single short message:
   - File path
   - Card count
   - Domain tags used
   - First 2 cards as a sanity preview

---

## Quality Bar (what to refuse)

Refuse to emit a card if any of these are true:
- The front is "What is X?" / "Define X" / "List the steps of X"
- The back is a single word or a definition copy-pasted from the document
- The card tests recall of a name, date, or number with no underlying
  principle
- Front + back together exceed ~6 sentences
- The principle field is empty or restates the front

If the entire document only supports fact-recall cards (e.g., a vocabulary
list with no roots, a list of dates with no causal pattern), say so
explicitly to the user and ask whether to proceed with lower-quality fact
cards anyway, rather than silently emitting them.

---

## Example Card (for reference, not to be copied verbatim)

| Field | Value |
|---|---|
| Front | `Using the principle that lipophilic molecules cross any biological membrane, predict whether a drug known to cross the blood-brain barrier can also enter the placenta. Justify.` |
| Back | `Yes. The blood-brain barrier is one of the body's most selective lipid bilayers. A molecule that crosses it has demonstrated the lipophilicity needed to cross less-restrictive membranes -- including the placenta. The principle: BBB-permeability implies general membrane-permeability, so one observation predicts behavior across many tissues.` |
| Principle | `Membrane permeability transitivity` |
| Tags | `source::pharmacology-lecture-3 pharmacology principle::membrane-permeability` |

CSV row form:
```
"Using the principle that lipophilic molecules cross any biological membrane, predict whether a drug known to cross the blood-brain barrier can also enter the placenta. Justify.","Yes. The blood-brain barrier is one of the body's most selective lipid bilayers. A molecule that crosses it has demonstrated the lipophilicity needed to cross less-restrictive membranes -- including the placenta. The principle: BBB-permeability implies general membrane-permeability, so one observation predicts behavior across many tissues.","Membrane permeability transitivity","source::pharmacology-lecture-3 pharmacology principle::membrane-permeability"
```
