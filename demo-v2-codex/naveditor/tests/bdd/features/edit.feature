Feature: File Editor
  Scenario: View a file
    When I run the edit command with "tests/fixtures/sample-files/hello.txt"
    Then I should see the contents of "hello.txt"
