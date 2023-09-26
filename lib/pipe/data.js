const result = {
    run: {
        public_uid: "UID-12345",
        title: "Playwright simple test to the HTML",
        link: "https://www.google.com/",
        status: "PASSED",
        project: "Project title",
        start: "12:43:01",
        end: "12:45:31",
        // suites: []
        tests: [
            { suite_title: "Suite #1", title: "My Playwright test #1.1", status: "PASS", message: "", stack: "", run_time: "00:01:11" },
            { suite_title: "Suite #1", title: "My Playwright test #1.2", status: "PASS", message: "", stack: "", run_time: "00:01:11" },
            { suite_title: "Suite #1", title: "My Playwright test #2", status: "FAIL", message: "", stack: "", run_time: "00:01:11" },
            { suite_title: "Suite #1", title: "My Playwright test #3", status: "SKIP", message: "msg", stack: "", run_time: "00:01:11" }
        ]
    }
}

window.result = result;

// module.exports = {
//     result
// }