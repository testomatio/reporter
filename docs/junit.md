## JUnit Reports

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

> [!NOTE]
> If your tests are located in a folder other other than `src/test/java`, specify a path to test files using `--java-tests` option: `--java-tests="path/to/tests"`

Screenshots or videos from tests are uploaded if test contains output with a path to file of following format:

```
file://path/to/screenshot.png
```

Use `System.out.println` to print an absulute path to file that should be uploaded as a screenshot.

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

### Assign Test ID

To link test in source code with test in Testomat.io add Test ID as a comment:

```java
  @Test
  public void testAddition() {
    // @T8acca9eb
    MyMath myMath = new MyMath();
    int result = myMath.add(2, 3);
    assertEquals(5, result);
}
```
In this case `@TT8acca9eb` is ID of existing test inside Testomat.io project

Alternatively, if the code can't be imported by a reported, use output inside a test to print its ID:


```java
public void testAddition() {
  MyMath myMath = new MyMath();
  int result = myMath.add(2, 3);
  System.out.println("tid://@T8acca9eb"); // here we print test ID
  assertEquals(5, result);
}
```

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

To upload an arbitrary file as artifact, print its absulute path to console:

```c#
Console.WriteLine("file://path/to/file.png");
```

### Assign Test ID

To link test in source code with test in Testomat.io print a Test ID inside a test:

```java
Console.WriteLine("tid://@T8acca9eb"); // here we print test ID
```

Use `tid://` prefix with a existing Test ID to match test with ID.

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

### Assign Test ID

To link test in source code with test in Testomat.io print a Test ID inside a test:

```java
puts "tid://@T8acca9eb" // here we print test ID
```

Use `tid://` prefix with a existing Test ID to match test with ID.

## PHPUnit

Generate PHPUnit XML and import it

```
TESTOMATIO={API_KEY} npx report-xml "report.xml" --lang php
```

