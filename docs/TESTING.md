# System Testing


## Test Reporting
Tests should be runnable against a given build. Each set of test results should be stored as its own file or directory artifact in a known location. Ideally, the known location will have a "latest" artifact that stores a copy or link to the latest test result/artifact.


## Behavior-Driven Testing
Having a full suite of understandable and organized tests that exercise the full behavior of a system is the best way to be confident that you are deploying something worth deploying. Monitoring those tests and/or their results is what lets us know that the system under test is ready for deployment. As such, we prefer higher-level tests to assess the status of broad system behaviors.

* Gherkin


## Unit Testing
Unit tests are useful to help ensure that your system is well-organized and not overly complex. If a unit test is hard to understand (assuming you understand business intent) and you can think of a way to reorganize the logic, it might be worth doing some refactoring (rather than contorting yourself or building extra test infrastructure).


## Test/Software Design Principles

### Arrange/Act/Assert Pattern
Structure tests in three clear phases: Arrange (set up test data and dependencies), Act (execute the code being tested), and Assert (verify the expected outcomes). This pattern improves test readability and makes it easier to identify what failed and why.

### Inversion of Control
Design code to accept dependencies as parameters rather than creating them internally. This allows tests to inject mocks, stubs, or test doubles, making unit tests isolated, fast, and reliable. Favor dependency injection and constructor/property injection patterns.

### Full Code Coverage
Strive for comprehensive test coverage of your codebase. Coverage tools help identify untested code paths. Code should all be covered or explicitly left uncovered by indicating exclusion to coverage tools. Since tests will live on longer than the developer remembers why they were written, the coverage/exclusion should remain as a mark of the code's consideration at the time of writing. If the tests are hard to write/read, this is a prime indicator that refactoring or re-organization of the logic for the software under test is worth considering.

### Parameterized Tests
Use parameterized tests to run the same test logic with multiple input values. This reduces duplication, makes it easier to add new test cases, and clearly shows the range of scenarios being validated. Many testing frameworks support data-driven tests through tables, arrays, or generators.

