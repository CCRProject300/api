# KudosHealth API

Routes with ":key:" are authenticated via JWT in the `Authorization` HTTP header. Routes with " :mortar_board:" require the user to be a moderator of the group (company/league) it operates on. Routes with ":family:" require the user to be a member (or moderator) of the group it operates on.

## Public

### POST /auth
Authenticate a user. Get a JWT.

### :key: GET /user
Get logged in user details.

### POST /user
Create a new user.

### POST /user/password/forgot
Send a forgot password email.

### POST /user/password/reset
Reset forgotten password using token.

### :key: PATCH /user
Update user details.

### :key: POST /connect/{app}
Connect an app, passing an `accessToken` and optional `refreshToken` and `profile`.

### :key: GET /notifications
Get notifications for a logged in user.

### :key: GET /notifications/{notificationId}/confirm
Confirm the given notification.

### :key: GET /notifications/{notificationId}/reject
Reject the given notification.

### :key: GET /leagues
Get all leagues for a user.

### :key: POST /league
Create a new league.

### :key: :family: GET /league/{leagueId}
Get league info.

### :key: :mortar_board: DELETE /league/{leagueId}
Delete a league.

### :key: :family: GET /league/{leagueId}/leaderboard
Get leaderboard for the given league.

### :key: :mortar_board: POST /league/{leagueId}/members
Add one or more members to a league.

### :key: :mortar_board: DELETE /league/{leagueId}/member/{userId}
Remove a member from a league.

### :key: :family: GET /team/{teamId}
Get team info.

### :key: :family: GET /team/{teamId}/leaderboard
Get leaderboard for the given team.

### :key: GET /companies
Get all companies for a user.

### :key: :mortar_board: GET /company/{companyId}/members
Get all company members.

### :key: :mortar_board: POST /company/{companyId}/members
Add one or more company members.

### :key: :mortar_board: POST /company/{companyId}/members/coins
Distribute kudosCoins to company members

### :key: :mortar_board: DELETE /company/{companyId}/member/{userId}
Remove a company member.

### :key: :mortar_board: GET /company/{companyId}/leagues
Get all company leagues.

### :key: :mortar_board: POST /company/{companyId}/league
Create a new company league.

### :key: :mortar_board: DELETE /company/{companyId}/league/{leagueId}
Delete a company league.

### :key: :mortar_board: GET /company/{companyId}/stats
Get company stats.

### :key: :family: GET /company/{companyId}/shop/items
Get all items in the shop.

### :key: :mortar_board: GET /company/{companyId}/shop/item/{itemId}
Get a shop item.

### :key: :mortar_board: POST /company/{companyId}/shop/item
Create a new shop item.

### :key: :mortar_board: PATCH /company/{companyId}/shop/item/{itemId}
Update a shop item.

### :key: :mortar_board: DELETE /company/{companyId}/shop/item/{itemId}
Delete a shop item.

### :key: :family: POST /company/{companyId}/shop/item/{itemId}/buy
Buy an item from the shop.

### :key: :family: GET /company/{companyId}/charity/buckets
Get all charity buckets.

### :key: :mortar_board: GET /company/{companyId}/charity/bucket/{bucketId}
Get a charity bucket.

### :key: :mortar_board: POST /company/{companyId}/charity/bucket
Create a new charity bucket.

### :key: :mortar_board: PATCH /company/{companyId}/charity/bucket/{bucketId}
Update a charity bucket.

### :key: :mortar_board: DELETE /company/{companyId}/charity/bucket/{bucketId}
Delete a charity bucket.

### :key: :family: POST /company/{companyId}/charity/bucket/{bucketId}/donate
Donate to a charity bucket.

### :key: :mortar_board: GET /company/{companyId}/transaction-logs?skip={skip}&limit={limit}
Get the company transaction log, sorted in reverse chronological order.

### :key: GET /graph?strategy={strategy}&timespan={timespan}
Get graph data. Optionally limit by strategy and change timespan.

### :key: GET /stats
Get user stats.

### :key: GET /search/users?q={query}
Search for users.

### :key: :family: POST /invite/league/{groupId}/member
Respond to an invitation to join a league.

### :key: :family: POST /invite/company/{groupId}/member
Respond to an invitation to join a company.

### :key: :family: POST /invite/company/{groupId}/moderator
Respond to an invitation to moderate a company.

### :key: GET /transaction-logs?skip={skip}&limit={limit}&types={types}
Get transaction logs for the logged in user, sorted in reverse chronological order, optionally filtered by type.

## Admin

### :key: GET /admin/users
Get all users.

### :key: PATCH /admin/user/{userId}
Update a user.

### :key: DELETE /admin/user/{userId}
Delete a user.

### :key: GET /admin/companies
Get all companies.

### :key: POST /admin/company
Create a new company.

### :key: PATCH /admin/company
Update an existing company.

### :key: DELETE /admin/company/{companyId}
Delete a company.

### :key: GET /admin/company/{companyId}/moderators
Get company moderators.

### :key: POST /admin/company/{companyId}/moderators
Add one or more company moderators.

### :key: DELETE /admin/company/{companyId}/moderator/{userId}
Remove a company moderator.
