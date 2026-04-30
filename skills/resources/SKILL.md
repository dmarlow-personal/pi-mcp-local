---
name: resources
description: MCP documentation library -- book inventory, search strategies, domain mapping, and research methodology
---

# Resources & Documentation Guide

Comprehensive reference for MCP documentation. Contains:
- Complete resource inventory (books, white papers, articles)
- Domain-to-resource mapping
- Search strategies by task type
- Query construction guidelines
- Research methodology
- Citation format

**Note:** Core research requirements are in `AGENTS.md`. This file provides detailed methodology.

Invoke with `/skill:resources` when planning or researching.

---

## Resource Inventory

### Books (17)

- **Clean Architecture** -- SOLID, boundaries, layers; ports, adapters, use cases, dependency rule, hexagonal
- **Clean Code** -- functions, naming, quality; small functions, meaningful names, code smells, refactoring
- **Fluent Python** -- Python idioms; decorators, generators, async, dunder methods, protocols
- **DDIA** -- distributed systems, data; replication, partitioning, consensus, transactions, storage
- **Microservice Patterns** -- service design; sagas, CQRS, API gateway, event sourcing
- **Deep Learning** -- neural networks, ML; backprop, optimization, CNN, RNN, transformers, attention
- **Fundamentals of Software Architecture** -- architecture styles; layered, microkernel, event-driven, trade-offs
- **Site Reliability Engineering** -- operations; SLOs, error budgets, toil, monitoring
- **Security Engineering** -- threat modeling; trust boundaries, attack trees, protocols
- **Full Stack Python Security** -- web security; XSS, CSRF, injection, authentication, sessions
- **Applied Cryptography** -- cryptographic algorithms; AES, RSA, hashing, key exchange, signatures
- **Computer Security Principles** -- security foundations; access control, authentication, integrity
- **Hacking Art of Exploitation** -- attack techniques; buffer overflow, shellcode, memory corruption
- **Pro Git** -- version control; branching, rebasing, hooks, reflog, bisect
- **Debugging (Agans)** -- 9 Rules methodology; make it fail, divide conquer, check the plug
- **Why Programs Fail** -- scientific debugging; delta debugging, hypothesis, experiments
- **SICP** -- computation theory; abstraction, recursion, interpreters, evaluation

### White Papers (310+ PDFs)

AI/ML research, security analysis, performance benchmarks, architecture case studies.
Search tip: `file_type="pdf"` searches books AND white papers together.

### Web Articles (Markdown)

Curated AI research from: Anthropic, OpenAI, Google AI, IBM Think, NVIDIA, Intel.
Search tip: `file_type="md"` for articles only. Check frontmatter for `source`, `published_date`.

---

## Domain Mapping

- **Class/Object Design** -- Clean Architecture, Clean Code; SOLID, single responsibility, interface segregation
- **Function Design** -- Clean Code, Fluent Python; small functions, command query separation, side effects
- **Error Handling** -- Clean Code, Fluent Python; exceptions, fail fast, error recovery
- **Python Idioms** -- Fluent Python; decorators, generators, comprehensions, protocols
- **Async/Concurrency** -- Fluent Python, DDIA; asyncio, threading, GIL, concurrent futures
- **Distributed Systems** -- DDIA, Microservice Patterns; replication, partitioning, consensus, CAP
- **Microservices** -- Microservice Patterns, DDIA; sagas, CQRS, event sourcing, API gateway
- **Architecture** -- Clean Architecture, Fundamentals; layers, hexagonal, dependency rule, boundaries
- **Reliability/SRE** -- SRE, DDIA; SLOs, error budgets, monitoring, incident response
- **Security** -- Security books (5); authentication, authorization, cryptography, attacks
- **Debugging** -- Agans, Zeller; systematic, divide conquer, scientific method
- **Git/VCS** -- Pro Git; branching, rebasing, workflows, conflict resolution
- **ML/AI** -- Deep Learning, Web Articles; neural networks, transformers, optimization

---

## Search Strategies by Task

### Architecture and Design

- Class design -- `"SOLID principles [specific principle] class design"` -- Clean Architecture
- Refactoring -- `"refactoring code smells extract method"` -- Clean Code
- Architecture style -- `"[style] architecture characteristics trade-offs"` -- Fundamentals
- Boundaries -- `"dependency rule layers boundaries ports adapters"` -- Clean Architecture

### Implementation

- Function design -- `"clean code function design small single purpose"` -- Clean Code
- Error handling -- `"exception handling best practices fail fast"` -- Clean Code, Fluent Python
- Python patterns -- `"python [pattern] idiom implementation"` -- Fluent Python
- Testing -- `"test driven development unit testing TDD"` -- Clean Code

### Systems and Operations

- Data storage -- `"storage engine indexing B-tree LSM"` -- DDIA
- Replication -- `"replication leader follower consensus"` -- DDIA
- Microservices -- `"microservice [pattern] saga CQRS"` -- Microservice Patterns
- Reliability -- `"SLO error budget incident response toil"` -- SRE

### Security

- Web security -- `"XSS CSRF injection input validation"` -- Full Stack Security, Hacking
- Authentication -- `"authentication session OAuth JWT"` -- Full Stack Security
- Cryptography -- `"[algorithm] encryption key management"` -- Applied Cryptography
- Threat modeling -- `"threat model trust boundaries attack"` -- Security Engineering

### Debugging

- Systematic -- `"debugging rules divide conquer make it fail"` -- Agans
- Scientific -- `"delta debugging hypothesis experiment"` -- Zeller
- Python-specific -- `"python debugging pdb profiling"` -- Fluent Python

### AI Research (Current)

- Agentic AI -- `"agentic AI tool use heterogeneous"` -- NVIDIA, Anthropic articles
- Model optimization -- `"inference optimization quantization"` -- Intel, NVIDIA articles
- Transformers -- `"transformer attention mechanism"` -- Deep Learning, articles

---

## Query Construction

Good queries (3-5 specific keywords):
```
"dependency inversion principle abstraction interface"
"API gateway authentication OAuth JWT microservice"
"async await asyncio concurrent python patterns"
"SQL injection parameterized queries input validation"
"systematic debugging divide conquer methodology"
```

Bad queries (too vague): "architecture", "security", "python", "best practices"

Query patterns:
- Design principle -- `"[principle] [related concepts] [domain]"`
- Implementation -- `"[pattern] [language] implementation"`
- Security -- `"[attack/defense] [tech] prevention"`
- Performance -- `"[operation] optimization [technology]"`
- Debugging -- `"debugging [symptom] [methodology]"`

---

## Research Methodology

### Phase 1: Query Planning (before searching)

Stop and think. Identify:
1. Primary domain -- which 2-3 books are most relevant?
2. Adjacent domains -- what related areas might have insights?
3. Recency needs -- do I need current practices (articles, web)?
4. Empirical needs -- would benchmarks/studies help (white papers)?
5. **Graph shape** -- is the query *named-entity* or *topical-overview* shaped?
   - Named entity ("Raft", "Paxos", "Diego Ongaro") -> `docs_entity_lookup` first, then
     `docs_entity_neighbors` / `docs_documents_mentioning` / `docs_semantic_search(entity=X)`.
   - Topical survey ("what does the corpus say about X") ->
     `docs_search_communities(X)` first -- each hit is a pre-condensed summary,
     often replacing 10+ `docs_semantic_search` + `docs_vault_document_read` pairs.
   - Structural ("concepts in this one doc") -> `docs_entities_in_document(doc_id)`.
   Graph tools no-op when extraction hasn't populated the index; fall through to book/article
   searches if they return empty.

   **Section coverage caveat:** the doc graph indexes signal-dense sections only.
   Books extract main body (skip front/back matter: preface, TOC, bibliography, glossary,
   index, appendices). Papers extract abstract + intro + conclusion + discussion + summary
   only. Entity-anchored retrieval on paper-body concepts or book reference apparatus
   will return empty -- drop the `entity=` filter and use plain `docs_semantic_search`
   in that case. All filtered material remains fully indexed for `docs_semantic_search`;
   the filter only governs what feeds the entity graph.

Write out the search plan before executing.

### Phase 2: Search Breadth Requirements

Minimum searches by task:
- Architecture decision -- 6+: 2 books, 1 white paper, 1 article, 1 web, 1 code example
- Feature implementation -- 5+: 2 books, 1 article, 1 web, 1 code example
- Bug investigation -- 4+: debugging books, domain book, 1 web, 1 article
- Security review -- 5+: 2 security books, 1 white paper, 1 article, 1 web
- Performance optimization -- 5+: DDIA/SRE, 1 white paper, 1 article, 1 web, 1 code example
- New technology -- 6+: 1 book, 2 articles, 2 web, 1 white paper

### Phase 3: Cross-Resource Strategy

Each resource type provides different value:
- **Books** -- foundational principles, proven patterns. Start here.
- **White Papers** -- empirical studies, benchmarks, newer techniques.
  Search: `"[concept] benchmark evaluation"`
- **Articles** -- current industry practices, production experiences.
  Search: `"[concept] production 2024 2025"`
- **Web Search** -- live documentation, recent releases.
  Search: `"[framework] [version] [question]"`
- **Code Examples** -- real implementations from experts. Validate approach against book implementations.

### Phase 4: Discovering Non-Obvious Value

White papers contain empirical comparisons, benchmarks, newer techniques, and production case studies
that books don't have. Search with: `"[concept] benchmark comparison"`, `"[technology] empirical study"`.

Adjacent domain insights: security patterns apply to reliability, distributed systems to microservices,
debugging methodology to performance investigation.

### Research Checklist

Before concluding:
- [ ] Searched at least 2 different books
- [ ] Checked white papers for empirical data
- [ ] Searched articles for current practices
- [ ] Used web search for live documentation
- [ ] Explored at least 1 adjacent domain
- [ ] Found code examples to validate approach
- [ ] Cross-referenced findings across sources

---

## Using Code Examples

1. Search principles: `docs_semantic_search("<concept> <pattern>")`
2. Read full text: `docs_vault_document_read(file_path, section)`
3. Find examples: `docs_list_code_examples(language="<target>", max_results=10)`
4. Validate implementation against expert examples

Available languages: Python, Java, JavaScript, TypeScript

---

## MCP Tools Quick Reference

Always available (no skill required):
- `docs_semantic_search` -- AI embedding + CrossEncoder reranking (compact breadcrumbs).
  Filter args: `entity=X` restricts to docs mentioning an entity;
  `link_boost=true` favors entity-dense chunks in the rerank.
- `docs_vault_document_read` -- full section or page text (use after search)
- `docs_search_all_docs` -- fast FTS5 keyword search. Pass `rewrite=false` for true
  exact-text lookups (error strings, identifiers, library symbols); the default
  `rewrite=true` rewrites the query into prose via local LLM and is closer to topical
  search than exact match.
- `docs_list_code_examples` -- code from authoritative books
- `docs_list_documents` -- document inventory by category
- `docs_get_document_metadata` -- document details (size, pages)

Graph / community layer (GraphRAG -- read-only, use by query shape):
- `docs_entity_lookup` -- typed entity card. FIRST call for any named concept, person,
  or technique -- avoid chunk retrieval when a structured identity card is what you need.
- `docs_search_communities` -- semantic search over Leiden-clustered community summaries.
  FIRST call for topical surveys -- each hit is a pre-condensed LLM summary; one call
  often replaces 10+ semantic-search round-trips.
- `docs_entity_neighbors` -- one-hop typed-relation traversal (INTRODUCES, CITES, REPLACES, ...).
- `docs_documents_mentioning` -- density-sorted list of docs referencing an entity.
- `docs_entities_in_document` -- who/what index for one document (optional section scope).
- `docs_entity_community` -- which Leiden communities contain an entity, with LLM summaries.

Code-graph bridge (optional -- only available when `CODE_GRAPH_URL` is set
on the upstream MCP server and the target repo has been indexed via
`code-graph index`. Most repos won't have it. Probe once with
`docs_cg_search`; on "not reachable" or empty hits for known symbols,
fall through to LSP / Grep + targeted `Read`):
- `docs_cg_search` -- FTS5 substring search on symbol names + signatures (probe + entry)
- `docs_cg_get_symbol` -- full symbol card + 1-hop neighborhood
- `docs_cg_reachability` -- N-hop forward / backward call-graph flood
- `docs_cg_adjacency` -- sibling symbols (sharing callers)
- `docs_cg_orphans`, `docs_cg_unused_exports` -- dead-code filters

Code communities (after `code-graph build-communities` + `build-summaries`):
- `docs_cg_symbol_community`, `docs_cg_communities_at_level`, `docs_cg_community`
- `docs_cg_communities_for_files`, `docs_cg_search_communities`

Cross-graph (after `mcp-docs-extract-entities link-cross-graph`):
- `docs_cg_links_for_community` -- doc-side hits linked to a code subsystem
- `docs_cg_links_for_doc` -- reverse: code subsystems implementing a doc concept

Skill-gated:
- `/skill:vault` -- `docs_vault_write`, `docs_vault_move`
- `/skill:assist` -- `docs_assist` (Qwen 3.6 27B peer reviewer)
- `/skill:security-audit` -- `docs_audit_repo_security`
- `/skill:code-graph` -- the full `docs_cg_*` toolkit (load only after a
  successful bridge probe)

---

## Plan Output Format

Save to `docs/plans/` with checklist format:

```markdown
# Plan: [Feature Name]
## Summary
## Tasks
- [ ] Task 1
## Files to Modify
- `path/to/file.ts` -- [description]
## Verification
- [ ] Tests pass
```

---

## Citation Format

In conversation (never in code):
```
Source: [Book Name], [Chapter/Section]
Principle: [Name]
Application: [How it applies]
```

Web articles:
```
Source: [Title] ([Source], [Date])
URL: [link]
Finding: [Key insight]
```
