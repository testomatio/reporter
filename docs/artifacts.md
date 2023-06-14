# 🛡 Artifacts

Artifacts are files produced by test runner, usually screenshots, videos or traces.

![](./images/artifacts.png)

Testomat.io Reporter uses a custom S3 bucket for artifacts which can be obtained from any S3 provider, like AWS, DigitalOcean and others. This makes artifacts storage to be independent from Testomat.io Application. In case you decide to stop using it, you still control your data. It is also up to you to clean old artifacts when you don't need them.


> **Notice**
> Testomat.io Application won't bill you for stored artifacts, as they are stored in your bucket. If you don't have S3 bucket yet, it's not more than 5$ a month to purchase them one of the cloud providers. S3 was chosen as it is de-facto standard for file storage for cloud hostings. All of them except Microsoft Azure support S3 protocol for storing files.

If a test files, a test runner may produce screenshot, video, or trace of a failed test. These files will be picked up by a reporter and uploaded to S3 bucket and attached to test. 

### Configuration

There are two options passing S3 bucket credentials:

* via environment variables
* by connecting to Testomat.io Application

Recommended way is passing S3 bucket credentials as environment variables:

- **S3_REGION** - Region your bucket lies.
- **S3_BUCKET** - Bucket name.
- **S3_ACCESS_KEY_ID** - Access key.
- **S3_SECRET_ACCESS_KEY** - Secret.
- **S3_ENDPOINT** - for providers other than AWS

These variables can be stored into `.env` file if tests are executed locally or added to CI configuration. Please keep `S3_SECRET_ACCESS_KEY` in secret.

If you use Testomat.io Application, you can set those variables inside Settings > Artifacts and share credentials with reporter



