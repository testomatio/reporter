const result = {
    "store": {
        "runUrl": "https://beta.testomat.io/projects/codecept-new-mode-exmple/runs/24346484/report",
        "runPublicUrl": null,
        "runId": "24346484"
    },
    "apiKey": "tstmt_gRqrhBUaVxTpezGpZjRmlahOeqcRBBbDMA1692050199",
    "isHtml": "1",
    "isEnabled": true,
    "htmlOutputPath": "html-report/testomatio-report.html",
    "results": [{
        "suite_title": "Create Tasks @step:06 @smoke @story:12 @S2f5c1942",
        "title": "Create a new todo item @T50e82737",
        "status": "passed",
        "message": "",
        "stack": "\u001b[32m\u001b[1mOn TodosPage: goto \u001b[22m\u001b[39m\n  I am on page \"http://todomvc.com/examples/angularjs/#/\" \u001b[90m(1712ms)\u001b[39m\n  I refresh page  \u001b[90m(844ms)\u001b[39m\n  I execute script () => sessionStorage.clear() \u001b[90m(9ms)\u001b[39m\n  I execute script () => console.error('Boom!') \u001b[90m(9ms)\u001b[39m\n  I wait for visible \".new-todo\" \u001b[90m(41ms)\u001b[39m\n\u001b[36m\u001b[1mGiven I have an empty todo list\u001b[22m\u001b[39m\n\u001b[36m\u001b[1mWhen I create a todo \"foo\"\u001b[22m\u001b[39m\n\u001b[32m\u001b[1mOn TodosPage: enter todo \"foo\"\u001b[22m\u001b[39m\n  I fill field \".new-todo\", \"foo\" \u001b[90m(94ms)\u001b[39m\n  I press key \"Enter\" \u001b[90m(39ms)\u001b[39m\n\u001b[36m\u001b[1mThen I see the new todo on my list\u001b[22m\u001b[39m\n\u001b[32m\u001b[1mOn TodosPage: see number of todos 1\u001b[22m\u001b[39m\n  I see number of visible elements \".todo-list li\", 1 \u001b[90m(9ms)\u001b[39m\n\n"
    }, {
        "suite_title": "@second Create Tasks @step:07 @smoke @story:13 @S2f5c1942",
        "title": "Create a new todo item part 2 @T5b8d1186",
        "status": "failed",
        "message": "expected expected number of visible elements (.todo-list li) is 2, but found 1 \"1\" to equal \"2\"",
        "stack": "\u001b[32m\u001b[1mOn TodosPage: goto \u001b[22m\u001b[39m\n  I am on page \"http://todomvc.com/examples/angularjs/#/\" \u001b[90m(1371ms)\u001b[39m\n  I refresh page  \u001b[90m(937ms)\u001b[39m\n  I execute script () => sessionStorage.clear() \u001b[90m(7ms)\u001b[39m\n  I execute script () => console.error('Boom!') \u001b[90m(8ms)\u001b[39m\n  I wait for visible \".new-todo\" \u001b[90m(24ms)\u001b[39m\n\u001b[36m\u001b[1mGiven I have an empty todo list\u001b[22m\u001b[39m\n\u001b[36m\u001b[1mWhen I create a todo \"foo\"\u001b[22m\u001b[39m\n\u001b[32m\u001b[1mOn TodosPage: enter todo \"foo\"\u001b[22m\u001b[39m\n  I fill field \".new-todo\", \"foo\" \u001b[90m(72ms)\u001b[39m\n  I press key \"Enter\" \u001b[90m(19ms)\u001b[39m\n\u001b[36m\u001b[1mThen I see the new todo on my list\u001b[22m\u001b[39m\n\u001b[32m\u001b[1mOn TodosPage: see number of todos 2\u001b[22m\u001b[39m\n  \u001b[31mI see number of visible elements \".todo-list li\", 2\u001b[39m \u001b[90m(10ms)\u001b[39m\n\n\u001b[1m\u001b[31m################[ Failure ]################\u001b[39m\u001b[22m\n\n\u001b[1mexpected expected number of visible elements (.todo-list li) is 2, but found 1 \"1\" to equal \"2\"\u001b[22m\n\n\n\u001b[1m\u001b[32m+ expected\u001b[39m\u001b[22m \u001b[1m\u001b[31m- actual\u001b[39m\u001b[22m\n\u001b[31m- 2\u001b[39m\n\u001b[32m+ 1\u001b[39m\n\n\n\n\u001b[1mLogs:\u001b[22m\n\u001b[30m  \u001b[31m\u001b[1m✖\u001b[22m\u001b[39m\u001b[30m Create a new todo item part 2 @T5b8d1186 \u001b[90min 153ms\u001b[39m\u001b[30m\u001b[39m"
    }],
    "htmlReportDir": "html-report",
    "htmlReportName": "testomatio-report.html",
    "templateFolderPath": "/home/vitalii/youtube-examples/smoke-test-testomat-0.8.3/codeceptjs-testomat-example/codeceptJS/node_modules/@testomatio/reporter/lib/template",
    "templateHtmlPath": "/home/vitalii/youtube-examples/smoke-test-testomat-0.8.3/codeceptjs-testomat-example/codeceptJS/node_modules/@testomatio/reporter/lib/template/template.hbs"
}

module.exports = {
    result
}