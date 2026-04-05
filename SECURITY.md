# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in Eksml, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, please email **liam@liampotter.co.uk** with:

- A description of the vulnerability
- Steps to reproduce it
- The potential impact
- Any suggested fix (optional)

You should receive an acknowledgement within 48 hours. Once the issue is confirmed, a fix will be developed and released as soon as possible, typically within 7 days for critical issues.

## Scope

Eksml is an XML/HTML parser that processes untrusted input by design. The following are considered in scope:

- Regular expression denial of service (ReDoS)
- Prototype pollution via parsed output
- Unexpected code execution via crafted input
- Denial of service via memory exhaustion or infinite loops

The following are **not** in scope:

- XML External Entity (XXE) attacks — Eksml does not resolve external entities
- XML bomb (billion laughs) — Eksml does not expand entity references
