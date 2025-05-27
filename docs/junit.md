## JUnit Reports

JUnit XML format is standard among test runners on various platforms. Testomat.io can load XML reports from test runners and create tests in a project from it. If your framework is not supported yet, generate JUnit report and upload it into Testomat.io

Testomat.io will not only create a run report but also collect all information about tests, including source code, and create tests in a system as regular importer do. The only difference that normal process of Testomat.io import does not require executing tests on import, while importing via reporter requires to have tests executed and XML report provided.

Tested Frameworks:

- JUnit (JUnit)
- Python (Pytest)
- Minitest (Ruby)
- PHPUnit (PHP)
- NUnit (C#)

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

- `pattern` - is a glob pattern to match all XML files from report. For instance, `"test/report/**.xml"` or just `report.xml`
- `--lang` option can be specified to identify source code of the project. Example: `--lang=Ruby` or `--lang=Java` or `--lang=Python`. Possible values:
  - `c#`
  - `java`
  - `ruby`
  - `python`
  - `php`
- `--java-tests` option is avaiable for Java projects, and can be set if path to tests is different then `src/test/java`. When this option is enable, `lang` option is automatically set to `java`
- `--env-file <envfile>` option to load environment variables from .env file. Inside env file TESTOMATIO credentials like `TESTOMATIO` api key or [bucket config for artifats](./artifacts.md).
- `--timelimit <time>` set a timer to silently kill a long-running reporter process due to network or other issues. For instance, use `--set-timeout=3` to stop process after 3 secs.

## XML Format

Testomat.io reporter can extract additional information from XML test output, including file attachments and test IDs. This is done by parsing specific patterns in the test output sections of JUnit XML reports.

### File Attachments

The reporter automatically detects and uploads files referenced in test output using the `file://` URL pattern. This works across different platforms and supports various file URL formats:

Supported File URL Formats:

- **Unix/Linux paths**: `file:///absolute/path/to/file.png` (3 slashes)
- **Unix/Linux paths**: `file://relative/path/to/file.png` (2 slashes)  
- **Windows paths**: `file:/C:\Users\username\path\to\file.png` (backslashes)
- **Windows paths**: `file://C:/Users/username/path/to/file.png` (forward slashes)

Example:

```xml
<testcase name="Login Test" classname="LoginTests">
  <system-out><![CDATA[
Test execution started
Step 1: Navigate to login page - PASSED
Step 2: Enter credentials - PASSED  
Step 3: Click submit button - FAILED

Evidence files captured:
- Screenshot: file:///home/user/screenshots/failed_test.png
- Additional screenshot: file://screenshots/screenshot1.png
- Windows path: file:/C:\Users\user\screenshots\failed_step.png
- Video recording: file://recordings/test_session.webm

Test completed with failures
  ]]></system-out>
  <failure message="Login failed">
    Expected login to succeed but got error: Invalid credentials
  </failure>
</testcase>
```

In this example, all four files would be automatically detected and uploaded as artifacts to the test report.

### Test ID Linking

Use the `tid://` pattern in test output to link test results with existing tests in Testomat.io:

```
tid://@T{test_id}
```

Where `{test_id}` is the 8-character test ID from Testomat.io (without the `@T` prefix in the URL).

#### Example XML Output

```xml
<testcase name="User Registration Test" classname="UserTests">
  <system-out><![CDATA[
Starting user registration test
tid://@T8acca9eb
User registration completed successfully
  ]]></system-out>
</testcase>
```

## Pytest

Run pytest tests and generate a report to `report.xml`:

```
pytest --junit-xml report.xml
```

Import report with this command

```
TESTOMATIO={API_KEY} npx report-xml report.xml --lang=python
```

To upload files as artifacts, print file paths to stdout using the `file://` pattern:

```python
def test_login():
    # Test logic here
    screenshot_path = "/tmp/screenshots/login_test.png"
    print(f"file://{screenshot_path}")
    
    # Link to existing test in Testomat.io
    print("tid://@T8acca9eb")
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

To upload screenshots or videos from tests, use `System.out.println` to print file paths with the `file://` pattern:

```java
@Test
public void testLogin() {
    // Test logic here
    String screenshotPath = "/tmp/screenshots/login_test.png";
    System.out.println("file://" + screenshotPath);
    
    // Link to existing test in Testomat.io  
    System.out.println("tid://@T8acca9eb");
}
```

### Assign Test ID

Test IDs can be applied to a test name. So to assign a test in a result to test in Testomat.io with ID `@T8acca9eb` add this ID to a test name if your test framework allows setting test names as a string.

```xml
<testcase name="test name @T8acca9eb"> ....
```

To place a test inside a specific suite you can set a suite ID similarly to a test ID:

```xml
<testcase name="test name @S1428a8fa"> ....
```

If a file with a source code is available to a reporter, you can link test in the test body and specify Test ID as a comment:

```java
  @Test
  public void testAddition() {
    // @T8acca9eb
    MyMath myMath = new MyMath();
    int result = myMath.add(2, 3);
    assertEquals(5, result);
}
```

In this case `@T8acca9eb` is ID of existing test inside Testomat.io project

Alternatively, if the code can't be imported by a reporter, use the `tid://` pattern in test output:

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

To upload an arbitrary file as artifact, print its absolute path to console using the `file://` pattern:

```c#
[Test]
public void TestLogin()
{
    // Test logic here
    string screenshotPath = @"C:\temp\screenshots\login_test.png";
    Console.WriteLine($"file://{screenshotPath}");
    
    // Link to existing test in Testomat.io
    Console.WriteLine("tid://@T8acca9eb");
}
```

### Assign Test ID

To link test in source code with test in Testomat.io print a Test ID inside a test using the `tid://` pattern:

```c#
Console.WriteLine("tid://@T8acca9eb"); // here we print test ID
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

To upload files as artifacts, print file paths using the `file://` pattern:

```ruby
def test_user_login
  # Test logic here
  screenshot_path = "/tmp/screenshots/login_test.png"
  puts "file://#{screenshot_path}"
  
  # Link to existing test in Testomat.io
  puts "tid://@T8acca9eb"
end
```

### Assign Test ID

Add test ID to a test name prefixed with `@T`. For instance, to link test from source code to test with id `@T8acca9eb` add TID to a test title:

```ruby
  test 'export test as yaml @T8acca9eb' do
    # ....
  end
```

To place a test inside a specific suite you can set a suite ID similarly to a test ID:

```ruby
  test 'export test as yaml @S1428a8fa' do
    # ....
  end
```

To link test in source code with test in Testomat.io print a Test ID inside a test using the `tid://` pattern:

```ruby
puts "tid://@T8acca9eb" # here we print test ID
```

## PHPUnit

Generate PHPUnit XML and import it

```
TESTOMATIO={API_KEY} npx report-xml "report.xml" --lang php
```

To upload files as artifacts, print file paths using the `file://` pattern:

```php
public function testLogin()
{
    // Test logic here
    $screenshotPath = '/tmp/screenshots/login_test.png';
    echo "file://$screenshotPath\n";
    
    // Link to existing test in Testomat.io
    echo "tid://@T8acca9eb\n";
}
```
