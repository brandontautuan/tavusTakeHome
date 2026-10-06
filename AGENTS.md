# Repository guidance

## Documentation and repository hygiene

- Keep `README.md` current whenever a change affects setup, run/build commands, architecture, demo behavior, integrations, environment variables, or user-facing features.
- If a `README.md` does not exist and the change introduces a runnable application, create a concise one with prerequisites, install, run, build, and a short feature overview.
- Update `.gitignore` whenever a new tool, framework, build output, cache, local environment file, test artifact, or editor-generated file is introduced. Do not ignore source files, lockfiles, or other files required for a reproducible build.
- Before finishing, check `git status --short` to confirm only intended source, configuration, and documentation files are unignored.

## Frontend prototype boundaries

- Keep the prototype frontend-only unless a request explicitly authorizes backend work.
- Preserve the replaceable persistence and integration boundaries; real API, Tavus, authentication, and messaging implementations belong behind those interfaces.
- Treat all bundled data as fictional demo data. Do not add clinical assessments, diagnosis, therapy claims, or dependency-building language.
