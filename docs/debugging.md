# Debugging reporter

To enable debug logs, set `DEBUG` environment variable to required module name, e.g.:

```bash
DEBUG=@testomatio/reporter:pipe:testomatio npx codeceptjs run
```

You may pass several modules separated by comma:

```bash
DEBUG=@testomatio/reporter:pipe:testomatio,@testomatio/reporter:pipe:github npx codeceptjs run
```

Or enable all logs:

```bash
DEBUG=* npx codeceptjs run
```

Reporter consists of many modules, so you can enable debug logs for any of them. The most useful are:

| Module | Value |
| ------ | ----- |
| **▼ Testomatio** |
| client | `@testomatio/reporter:client` |
| storage | `@testomatio/reporter:storage` |
| **▼ Pipes** |
| Testomatio | `@testomatio/reporter:pipe:testomatio` |
| GitHub | `@testomatio/reporter:pipe:github` |
| SCV | `@testomatio/reporter:pipe:csv` |
| GitLab | `@testomatio/reporter:pipe:gitlab` |
| HTML | `@testomatio/reporter:pipe:html` |
| **▼ Adapters** |
| Codecept | `@testomatio/reporter:adapter:codeceptjs` |
| Jest | `@testomatio/reporter:adapter-jest` |
| **▼ Services** |
| Artifacts | `@testomatio/reporter:services-artifacts` |
| Meta (key-value) | `@testomatio/reporter:services-key-value` |
| Logger | `@testomatio/reporter:services-logger` |
