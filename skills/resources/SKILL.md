---
name: resources
description: MCP documentation library - book inventory, search strategies, and domain mapping
---

# Resources & Documentation Guide

Complete reference for the MCP documentation library.

## Resource Inventory (17 Books)

- **Clean Architecture** -- SOLID, boundaries, layers, hexagonal, dependency rule
- **Clean Code** -- functions, naming, quality, code smells, refactoring
- **Fluent Python** -- decorators, generators, async, dunder methods, protocols
- **DDIA** -- replication, partitioning, consensus, transactions, storage
- **Microservice Patterns** -- sagas, CQRS, API gateway, event sourcing
- **Deep Learning** -- backprop, optimization, CNN, RNN, transformers
- **Fundamentals of Software Architecture** -- layered, microkernel, event-driven
- **Site Reliability Engineering** -- SLOs, error budgets, toil, monitoring
- **Security Engineering** -- threat modeling, trust boundaries, attack trees
- **Full Stack Python Security** -- XSS, CSRF, injection, authentication
- **Applied Cryptography** -- AES, RSA, hashing, key exchange
- **Computer Security Principles** -- access control, authentication, integrity
- **Hacking Art of Exploitation** -- buffer overflow, shellcode, memory corruption
- **Pro Git** -- branching, rebasing, hooks, reflog, bisect
- **Debugging (Agans)** -- 9 Rules: make it fail, divide conquer, check the plug
- **Why Programs Fail** -- delta debugging, hypothesis, experiments
- **SICP** -- abstraction, recursion, interpreters, evaluation

Plus 310+ white papers and curated web articles (Anthropic, OpenAI, Google, IBM, NVIDIA, Intel).

## Domain Mapping

- **Class/Object Design** -- Clean Architecture, Clean Code
- **Function Design** -- Clean Code, Fluent Python
- **Error Handling** -- Clean Code, Fluent Python
- **Python Idioms** -- Fluent Python
- **Distributed Systems** -- DDIA, Microservice Patterns
- **Architecture** -- Clean Architecture, Fundamentals
- **Security** -- Security books (5)
- **Debugging** -- Agans, Zeller
- **ML/AI** -- Deep Learning, Web Articles

## Search Strategies

Good queries (3-5 specific keywords):
```
"dependency inversion principle abstraction interface"
"API gateway authentication OAuth JWT microservice"
"systematic debugging divide conquer methodology"
```

Bad queries: "architecture", "security", "python"

## Research Methodology

Minimum searches by task:
- Architecture decision: 6+ (2 books, 1 white paper, 1 article, 1 web, 1 code)
- Feature implementation: 5+ (2 books, 1 article, 1 web, 1 code)
- Bug investigation: 4+ (debugging books, domain book, 1 web, 1 article)
- Security review: 5+ (2 security books, 1 white paper, 1 article, 1 web)

## Tools Quick Reference

Always available:
- `docs_semantic_search` -- AI embedding + CrossEncoder reranking
- `docs_vault_document_read` -- full section text (use after search)
- `docs_search_all_docs` -- fast FTS5 keyword search
- `docs_list_code_examples` -- code from books
- `docs_list_documents` -- inventory by category
- `docs_get_document_metadata` -- document details

## Citation Format

In conversation (never in code):
```
Source: [Book Name], [Chapter/Section]
Principle: [Name]
Application: [How it applies]
```
