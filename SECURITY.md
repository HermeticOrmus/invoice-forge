# Security Policy

## Reporting a vulnerability

Please report security issues **privately**. Do not open a public GitHub issue for vulnerabilities, and do not include secrets, credentials, API keys, payment details, or personal data in any report.

Preferred options:

1. Open a private [GitHub Security Advisory](https://github.com/HermeticOrmus/invoice-forge/security/advisories/new) on this repository.
2. Contact the maintainers via [ormus.solutions](https://ormus.solutions).

## What not to share publicly

- Contents of `config.json` (company, payment, and account details)
- Client databases (`clients/clients.json`)
- Generated invoices or PDFs under `documents/` or `invoices/`
- Any tokens, passwords, or private keys

## Scope

Invoice Forge is a self-hosted tool. Keep local data local. Fixes that improve safe defaults are welcome via normal pull requests when they do not require disclosing sensitive material.
