# Development and releases

This repository is archived. Active development and releases are maintained in the [official ai& upstream repository](https://github.com/aiandlabs/aiand-copilot-chat). These instructions describe the historical local build.

## Local workflow

```bash
npm ci
npm test
npm run package
```

Tests are colocated with the modules they cover under `src/auth/`, `src/models/`, `src/provider/`, `src/transport/`, and `src/usage/`. `npm test` performs a clean compile and runs credential-storage, provider-configuration, model-filtering, retry, stream-parser, protocol, error, cache, and usage tests. `npm run package` validates the project and creates an installable VSIX.

Install the local build with:

```bash
code --install-extension aiand-copilot-chat-<version>.vsix --force
```

For a live API check, put `AIAND_API_KEY` in an ignored local `.env` file or your shell environment. Never commit credentials or paste them into an issue.

## Historical release workflow

User-visible pull requests normally include a Changeset:

```bash
npm run changeset
```

The release workflow is disabled in this archive. Previously, Changesets maintained a version pull request on `main`. Merging that pull request published the VSIX to the Visual Studio Marketplace and attached the same artifact to a GitHub release. The release workflow skipped existing version tags to prevent duplicate publication.

The packaged extension contains compiled runtime files, Marketplace metadata, the changelog, license, README, and icon. Source, tests, maps, repository automation, project documentation, secrets, and local build artifacts are excluded by `.vscodeignore`.

## References

- [ai& API documentation](https://docs.aiand.com)
- [ai& model pricing and capabilities](https://docs.aiand.com)
- [ai& API console](https://console.aiand.com)
