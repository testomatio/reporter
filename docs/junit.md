## 🧰 JUnit Reports

JUnit XML format is standard among test runners on various platforms. Testomat.io can load XML reports from test runners and create tests in a project from it. If your framework is not supported yet, generate JUnit report and upload it into Testomat.io

Testomat.io will not only create a run report but also collect all information about tests, including source code, and create tests in a system as regular importer do. The only difference that normal process of Testomat.io import does not require executing tests on import, while importing via reporter requires to have tests executed and XML report provided.

Tested Frameworks:

* JUnit (JUnit)
* Python (Pytest)
* Minitest (Ruby)
* PHPUnit (PHP)
* NUnit (C#)


To enable Testomatio Reporter install `@testomatio/reporter` package


Use one of your favorite package managers:

```
npm install @testomatio/reporter --save-dev
```

```
pnpm install @testomatio/reporter --save-dev
```

```
yarn add @testomatio/reporter --dev
```

Run your test framework and generate a JUnit report.

Then import XML report into Testomat.io

```
npx report-xml "{pattern}" --lang={lang}
```

* `pattern` - is a glob pattern to match all XML files from report. For instance, `"test/report/**.xml"` or just `report.xml`
* `--lang` option can be specified to identify source code of the project. Example: `--lang=Ruby` or `--lang=Java` or `--lang=Python`. Possible values:
  * `c#`
  * `java`
  * `ruby`
  * `python`
  * `php`
* `--java-tests` option is avaiable for Java projects, and can be set if path to tests is different then `src/test/java`. When this option is enable, `lang` option is automatically set to `java`
* `--env-file <envfile>` option to load environment variables from .env file. Inside env file TESTOMATIO credentials like `TESTOMATIO` api key or [bucket config for artifats](./artifacts).
* `--timelimit <time>` set a timer to silently kill a long-running reporter process due to network or other issues. For instance, use `--set-timeout=3` to stop process after 3 secs.


## Pytest

Run pytest tests and generate a report to `report.xml`:

```
pytest --junit-xml report.xml
```

Import report with this command

```
TESTOMATIO={API_KEY} npx report-xml report.xml --lang=python
```

## JUnit

Run tests via Maven, make sure JUnit report was configured in `pom.xml`.

```
mvn clean test
```

Import report with this command:

```
TESTOMATIO={API_KEY} npx report-xml "target/surefire-reports/*.xml" --java-tests
```

> You can specify `--java-test` option to set a path to tests if they are located in path other than `src/test/java`

Screenshots or videos from tests are uploaded if test contains output with a path to file of following format:

```
file://path/to/screenshot.png
```

Use `System.out.println` to print a path to file that should be uploaded as a screenshot.

```java
System.out.println("file://" + pathToScreenshot);
```

This will produce XML report which contains path to a file:

```xml
<testcase>
  <system-out><![CDATA[
    file://path/to/scrrenshot.png
  ]]></system-out>
</testcase>
```

When XML report is uploaded, all files from `file://` will be uploaded to corresponding tests.

## NUnit

Generate NUnit XML report and run the following code:

```
TESTOMATIO={API_KEY} npx report-xml "report.xml" --lang="c#"
```

If NUnit generates `<ResultFiles>` section in XML report, all items from it will be uploaded as artifacts. For instance, this is available for **Playwright DotNet** integration.

```xml
<Results>
  <UnitTestResult>
    <ResultFiles>
      <ResultFile path="screenshot2.png" />
      <ResultFile path="data.zip" />
    </ResultFiles>
  </UnitTestResult>
```

To upload an arbitrary file as artifact, print its path to console:

```c#
Console.WriteLine("file://path/to/file.png");
```

## Ruby Minitest

```ruby
# test_helper.rb:

reporters = [Minitest::Reporters::DefaultReporter.new(color: true)]
# enable JUnit reporter
reporters << Minitest::Reporters::JUnitReporter.new

Minitest::Reporters.use! reporters
```

Launch tests:

```
rails test
```

Import reports from `test/reports` directory:

```
TESTOMATIO={API_KEY} npx report-xml "test/reports/*.xml" --lang ruby
```

## PHPUnit

Generate PHPUnit XML and import it

```
TESTOMATIO={API_KEY} npx report-xml "report.xml" --lang php
```

