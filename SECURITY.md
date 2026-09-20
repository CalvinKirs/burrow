# Security Policy

## Reporting a vulnerability

Please report security issues privately, not in a public issue.

Use GitHub's private reporting: open the [Security tab](https://github.com/CalvinKirs/burrow/security)
of this repository and choose **Report a vulnerability**. The report is visible only to the
maintainers.

Include what you can of the following:

- the Burrow version (see `chrome://extensions`) and your Chrome version and operating system,
- a Markdown file or folder layout that reproduces the problem,
- what an attacker gains (for example script execution, reading files outside the workspace,
  or data leaving the machine).

Reports are usually acknowledged within a week. Once a fix is released the advisory is
published and you are credited, unless you prefer otherwise.

## Supported versions

Only the [latest release](https://github.com/CalvinKirs/burrow/releases/latest) receives
security fixes.

## Scope

Burrow renders Markdown that may come from untrusted sources (a cloned repository, a downloaded
archive), so these are the properties we consider security boundaries:

- **No script execution from documents.** Rendered output always passes through DOMPurify; raw
  HTML is disabled unless you enable it in the options, and is sanitised even then. Mermaid runs
  with `securityLevel: 'strict'`.
- **Local files only.** The background worker and the offscreen document refuse to read any URL
  that is not `file:///`, and the extension requests no network host permissions.
- **No remote code.** Everything the extension executes ships inside the package.

Issues in bundled dependencies (markdown-it, highlight.js, DOMPurify, Mermaid) are in scope when
they are reachable through Burrow. Reports that require an already compromised browser profile or
a malicious extension installed alongside Burrow are out of scope.
