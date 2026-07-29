# Contributing to Sidekick

This repository is a working Lemma pod, so changes should preserve the complete product loop.

## Before opening a pull request

1. Validate the bundle with `lemma pods import . --dry-run`.
2. Build the application source when present.
3. Check that new tables, files, functions, and apps have the minimum required permissions.
4. Keep credentials, connector accounts, environment IDs, and live record data out of the commit.
5. Describe the human-visible behavior changed—not only the resource files touched.

## Product rule

Prefer durable, inspectable state and explicit human decision points over invisible automation.
