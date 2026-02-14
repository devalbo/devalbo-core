# Project Workflow Documentation

This document outlines the high-level workflow for our authentication service to test Mermaid rendering.

## 1. User Login Flow
This sequence diagram illustrates how a user logs into the system. It tests complex interactions and loops.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant App as Frontend App
    participant API as Backend API
    participant DB as Database

    User->>App: Clicks "Login"
    App->>User: Shows Login Form
    User->>App: Enters Username/Password
    App->>API: POST /login
    
    Note over API, DB: Authentication Check
    
    API->>DB: Query User Credentials
    alt Credentials Valid
        DB-->>API: User Found
        API-->>App: Return JWT Token
        App->>User: Redirect to Dashboard
    else Credentials Invalid
        DB-->>API: User Not Found
        API-->>App: Return 401 Error
        App->>User: Show Error Message
    end
```


## abc
more text here


```mermaid
sequenceDiagram
    autonumber
    actor User
    participant App as Frontend App
    participant API as Backend API
    participant DB as Database

    User->>App: Clicks "Login"
    App->>User: Shows Login Form
    User->>App: Enters Username/Password
    App->>API: POST /login
    
    Note over API, DB: Authentication Check
    
    API->>DB: Query User Credentials
    alt Credentials Valid
        DB-->>API: User Found
        API-->>App: Return JWT Token
        App->>User: Redirect to Dashboard
    else Credentials Invalid
        DB-->>API: User Not Found
        API-->>App: Return 401 Error
        App->>User: Show Error Message
    end
```

## part 3
fjlksfj
