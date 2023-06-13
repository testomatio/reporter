## Pipes

##### 🤔 What are Pipes?

Unilke other reporters Testomat.io Reporter doesn't force you to report data only to Testomat.io application. Testomat.io Reporer collects data from test frameworks and submits it via pipes to other services.

![](./images/reporter-pipes.png)

For instance, you can enable GitHub Pipe to create a comment on a GitHub Pull Request and CSV Export Pipe to write a report in CSV format. To report data to Testomat.io Application, Testomat.io Pipe should be enabled. You can write your own pipe to:

* send data to analytics storage
* store data into database
* send emails
* send notifications to chats
* ....

Pipes work in the very same manner for all supported test frameworks as well as for JUnit reports. So writing a pipe instead of a custom reporter for a particular framework, saves your time as you can be sure, this pipe will work with any attached test result.

Testomat.io Reporter doesn't store test data in any internal format. Test data is processed in memory. While a test is running all pipes are notified on changes. 

## Testomat.io Pipe

## GitHub Pipe

## GitLab Pipe

## CSV Pipe

## Custom Pipe