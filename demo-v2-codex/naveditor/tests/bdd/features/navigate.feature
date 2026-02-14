Feature: File Navigator
  Scenario: Navigate current directory
    When I run the navigate command without arguments
    Then I should see a list of files in the current directory
