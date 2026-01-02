Feature: Greet Command
  As a user of the demo CLI
  I want to greet people by name
  So that I can see personalized greeting messages

  Scenario: Greet with default name
    When I run the greet command without arguments
    Then I should see "Hello, World!"

  Scenario: Greet with a specific name
    When I run the greet command with "Alice"
    Then I should see "Hello, Alice!"

  Scenario: Greet with a multi-word name
    When I run the greet command with "Alice Smith"
    Then I should see "Hello, Alice Smith!"

  Scenario: Display help information
    When I run the help command
    Then I should see "Usage: demo"
    And I should see "Commands:"
    And I should see "greet"
    And I should see "Greet someone"
