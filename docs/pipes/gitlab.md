## GitLab Pipe

Similarly to [GitHub Pipe](#GitHub-Pipe), GitLab Pipe adds a comment with a summary of a run to a Merge Request:

This summary will contain:

* Status of a test run 
* Number of failed/passed/skipped tests
* Stack traces of failing tests (first 20)
* Screenshots of failed tests (if available)
* List of 5 slowest tests

**🔌 To enable GitLab pipe set `GITLAB_PAT` environment with GitLab Private Access Token**

### Keep Outdated Reports

If a pipeline is executed multiple times, comment with previous reports will be deleted. To keep them set `GITLAB_KEEP_OUTDATED_REPORTS=1`.
