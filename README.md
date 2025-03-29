## [TheraSuite App](https://therasuite.app/)

FEATURE: Allow therapists to create an appointment for multiple clients together for a single appointment.

Feature Implementation Requirements:
- First, when creating an appointment, add a dropdown to select the type of appointment: Single, Couple, Family.
- If the appointment is for a single client, the process is the same as the current process.
- If the appointment is for a couple or family, there will be 2 client names and 2 client emails.
- The custom meeting link will be the same for all clients.
- We'll need to update out database to use an array for client_name and client_email.
- We'll need to update the frontend to handle the new data structure.
- We'll need to update the backend to handle the new data structure.
- Multiple clients will not be added separately to the clients table, instead they will be added to a new table called client_groups.
- These client groups will be listed on the clients page as a client group rather than a single client.
- Under existing clients, there will now be the option of selecting a client group.
- Everything for the calls remains the same, the only difference is that the client_id will be the client_group_id.
- The client_group_id will be added to the appointments table.
- The emails will need to be sent to all the emails in the client_email array in case of a family or couple.