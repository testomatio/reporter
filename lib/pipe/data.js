const result = {
    run: {
        public_uid: "UID-12345",
        title: "Playwright simple test to the HTML",
        link: "https://www.google.com/",
        status: "PASSED",
        project: "Project title",
        start: "12:43:01",
        end: "12:45:31",
        suites: ["Suite #1", "Suite #2"], 
        tests: [
            { id: 1, 
              suite_title: "Suite #1",
              title: "My Playwright test #1.1",
              status: "PASS",
              message: "", stack: "",
              run_time: "00:01:11",
              code: `
                Scenario('Create a new todo item', async ({ I, TodosPage }) => {
                    I.say('Given I have an empty todo list');
                  
                    I.say('When I create a todo "foo"');
                    TodosPage.enterTodo('foo');
                  
                    I.say('Then I see the new todo on my list');
                    TodosPage.seeNumberOfTodos(1);
                  });
                `
            },
            { id: 2, suite_title: "Suite #1", title: "My Playwright test #1.2", status: "PASS", message: "", stack: "", run_time: "00:01:11",
                code: `
                Scenario('Create a new todo item #2', async ({ I, TodosPage }) => {
                    I.say('Given I have an empty todo list');
                });
                `
            },
            { id: 3, suite_title: "Suite #1", title: "My Playwright test #2", status: "FAIL", message: "", stack: "", run_time: "00:01:11" },
            { id: 4, suite_title: "Suite #1", title: "My Playwright test #3", status: "SKIP", message: "msg", stack: "", run_time: "00:01:11" }
        ]
    }
}

module.exports = {
    result
}