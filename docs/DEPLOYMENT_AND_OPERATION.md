
# Deployment & Operation

How users interact with software should be built in a layered approach unless performance demands. Ideally, the first layer should be an application in the style of Unix-style utilities that take actions with optional arguments. Statelessness at the command level is ideal. If state is required across commands, it should be maintained in a simple to manage/duplicate manner.

## Execution

Ideally, these commands can run in multiple environments and should be designed to accomodate at least these environments:
* command line
* web browser


## Persistence 
Persistence is required to maintain state and functionality across executions. Simple replication of identifiable blocks of bytes (e.g. files) for reproducibility and backup purposes is a fundamental requirements. 

## Identity
Identity of who owns data at the data-level is critically important. Owners of data should be responsible with sharing data with others as well as maintaining its versions and history. For commands that generate or update data, this means persistence should incorporate this concept as well.

Commands should be invoked with a user identity or persistence should provide a "default My User" in the event one is not provided. Commands that require a user that are invoked without one should fail with information to that effect.

Since [persistence](/docs/PERSISTENCE.md) will lead to storing user identities, this leads to some user profile concepts.

### "My User" Profiles
If persistence has access to users, there should be the concept of "my user profiles", which means the user has access to private keys to establish their identity. As such, persistence should have the concept of user profiles, ideally with one set as default.

### "Other User" Profiles
If the concept of "other users" is important to your application, there should be the concept of "other user profiles", which means "my user" is aware of keys the other users can use to establish their identity. As such, persistence should have the concept of "other user" profiles.

