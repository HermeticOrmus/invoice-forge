# Contributing to Invoice Forge

Thank you for your interest in contributing.

## Getting Started

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Run the linter: `ruff check .`
5. Commit with a descriptive message: `git commit -m "feat: add your feature"`
6. Push to your fork and open a pull request

## Commit Convention

We use conventional commits:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

## Code Style

- Python: Follow ruff defaults (pyproject.toml config)
- JavaScript: Vanilla JS, no frameworks, no build step
- CSS: CSS custom properties for theming, no preprocessors

## Philosophy

This project follows the Gold Hat philosophy:

- **Empower users** over extracting from them
- **Teach while helping** -- explain the why, not just the what
- **Respect autonomy** -- no dark patterns, no lock-in
- **Build long-term** -- solve root causes, not symptoms

## Reporting Issues

Open an issue with:
- What you expected
- What happened instead
- Steps to reproduce
- Your environment (OS, Python version, browser)
