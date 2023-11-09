// TODO: use as example for the unit-tests

const result = {
    "runId": "51eb2798",
    "status": "failed",
    "runUrl": "https://beta.testomat.io/projects/codecept-new-mode-exmple/runs/51eb2798/report",
    "executionTime": "0 seconds",
    "executionDate": "(30/07/2023 11:11:11)",
    "tests": [{
        "files": [],
        "steps": "\u001b[32m\u001b[1mOn TodosPage: goto \u001b[22m\u001b[39m\n",
        "status": "passed",
        "stack": "I execute script () => sessionStorage.clear()",
        "example": null,
        "code": null,
        "title": "Create a new todo item @T50e82737",
        "suite_title": "Create Tasks @step:06 @smoke @story:12 @S2f5c1942",
        "test_id": "50e82737",
        "message": "",
        "run_time": 121,
        "artifacts": [],
        "api_key": "tstmt_gRqrhBUaVxTpezGpZjRmlahOeqcRBBbDMA1692050199",
        "create": false
    }, {
        "files": [{
            "path": "/home/codeceptjs-testomat-example/codeceptJS/output/Create_2_@T5b8d1186.failed.png",
            "type": "image/png"
        }],
        "steps": "I am on page \"http://todomvc.com/examples/angularjs/#/\"",
        "status": "failed",
        "stack": "I am on page \"http://todomvc.com/examples/angularjs/#/\"",
        "example": null,
        "code": null,
        "title": "Create a new todo item part 2 @T5b8d1186",
        "suite_title": "@second Create Tasks @step:07 @smoke @story:13 @S2f5c1942",
        "test_id": "5b8d1186",
        "message": "expected expected number of visible is 2, but found 1 \"1\" to equal \"2\"",
        "run_time": 176,
        "artifacts": [null],
        "api_key": "tstmt_gRqrhBUaVxTpezGpZjRmlahOeqcRBBbDMA1692050199",
        "create": false
    }]
}

module.exports = {
    result
}