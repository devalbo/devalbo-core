Feature: Help Command
  Scenario: Display help information
    When I run the help command
    Then I should see "Usage: naveditor"
