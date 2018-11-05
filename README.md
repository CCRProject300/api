# KudosHealth API [![CircleCI](https://circleci.com/gh/tableflip/kudoshealth-api.svg?style=svg&circle-token=e867e7183e9db5bd49676a634bf64e6ce540aa8f)](https://circleci.com/gh/tableflip/kudoshealth-api)

## Getting started

* Install Node.js 6.x
* Install MongoDB
* Install Dependencies
    ```
    npm install
    ```
* Start Mongo
    ```
    mongod
    ```
* Configure the API by copying `config/default.json` to `config/development.json`.
* Start the API
    ```
    npm start
    ```

### Directory structure

```
.
├── config      # Site configuration
├── lib         # Modules shared between multiple routes
├── migrations  # Database migrations
├── routes      # API routes
└── tests       # Unit and integration tests
```

### Development

The `watch` script will run nodemon to restart the server when changes are made.

```
npm run watch
```

## API docs

[Documentation for the API](api.md).

## Concepts

The schemas for objects that represent the state of the system are defined here:

### User
A registered user.

```js
{
  _id: ObjectId,
  firstName: String,
  lastName: String,
  companyName: String,
  emails: [{ address: String, verified: Boolean }],
  emailPreferences : {
		league : Boolean,      // Added to league notification
		podium : Boolean,      // Weekly podium stats
		leaderboard : Boolean, // Daily Leaderboard change stats
		connected : Boolean    // Fill out your profile & connect a device reminder
	},
  password: String,
  // Connected devices
  methods: [{
    strategy: String,
    name: String,
    has_tracker: Boolean,
    last_tracker_update_date: Date,
    last_tracker_check_date: Date,
    last_tracker_update_value: Number,
    last_sync_status: String,
    info: {
      profile: {},
      id: String,
      token: String,
      tokenSecret: String
    }
  }],
  roles: [String], // user/corporate_mod/admin, plus any company-specific roles
  started: Boolean, // Has read getting started notification flag
  kudosCoins: Number // Integer number of kudosCoins this user has earned and not spent
  timezone: String,
  deleted: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Jwt
JSON Web Tokens.

```js
{
  _id: ObjectId,
  user: { _id: ObjectId }
  value: String,
  isValid: Boolean,
  expiresAt: Date
}
```

### Group (abstract)
A collection of users.

```js
{
  name: String,
  description: String,
  startDate: Date,
  endDate: Date,
  moderators: [{
    user: ObjectId,
    startDate: Date,
    endDate: Date,
    active: Boolean,
    activated: Boolean
  }],
  members: [{
    user: ObjectId,
    startDate: Date,
    endDate: Date,
    active: Boolean,
    activated: Boolean
  }],
  deleted: Boolean
}
```

### Company
A company _is a_ group. It _has many_ **Leagues**.

```js
{
  numberEmployees: Number,
  logo: String, // url, optional
  locations: [String],
  departments: [String],
  leagues: [{
    leagueId: ObjectId
  }],
  roles: [String] // available roles from config
}
/* + group */
```

### League
A league _is a_ group. It _has many_ **Panels**. A league only has panels if it's `teamSize` is larger than 1.

```js
{
  teamSize: Number || null, // null implies no maximum,
  minTeamSize: Number, // the minimum number of members to score points
  leagueType: String, // private, corporate
  panel: [{
    panelId: ObjectId
  }]
}
/* + group */
```

### Panel
A panel _is a_ group. It _has many_ **Teams**. Panels are referred to as "Categories" in the UI.

```js
{
  team: [{
    teamId: ObjectId
  }]
}
/* + group */
```

### Team
A team _is a_ group. The number of members that can be in a team is dictated by the league `teamSize`.

```js
{
  panel: {
    _id: ObjectId,
    name: String
  }
}
```

### Interval

```js
{
  _id: ObjectId,
  method: String, // strava/google-fit/fitbit/etc.
  startDate: Number, // ms since epoch
  userId: ObjectId,
  startOfDay: Number, // ms since epoch of the start of the *UTC* day containing the start of the interval.  Used for aggregation.
  height: Number, // cm
  weight: Number, // kg
  gender: String,
  dob: Date,
  kudosPoints: Number, // float
  endDate: Number, // ms since epoch
  calories: Number, // float
  maxForPeriod: Boolean // true if the "promote" task finds this to have the maximal KP for this user and time period
                        // only these are used to generate rankings/graphs to avoid double-counting across methods
  types: Array // normalised activity names during this interval
}
```

### Token
A token can be used to sign up as a new user and immediately become a member of the associated company

```js
{
  companyId: ObjectId,
  revoked: Boolean
}
```

### PasswordToken

Password reset tokens.

```js
{
  _id: ObjectId,
  user: { _id: ObjectId },
  value: String,
  redeemedAt: Date,
  expiresAt: Date
}
```

### Notification

Notification of an event or a requirement for a response to be published to the UI.

```js
{
  _id: ObjectId,
  user: { _id: ObjectId },
  type: 'onboarding',
  group: { _id: ObjectId, name: 'New League' },
  messages: ['You have been invited to join the league ', 'Select a group to join.', 'Do not join'],
  url: `/settings`, // optional front-end URL which will be pushed into history on acceptance
  panels: [{ _id: ObjectId: name: 'Group One' }] , // optional
  redeemedAt: '2016-08-12T14:46:11.332Z',
  deleted: false
}
```

### Shop Item

Item available for purchase (pending stock levels/sufficient coins) to members of a company.

```js
{
  _id: ObjectId,
  company: { _id: ObjectId },
  name: String,
  description: String, // optional
  image: String, // URL, optional
  stockLevel: Number, // Integer, >= 0
  price: Number, // Integer, > 0
  deleted: false,
  createdAt: Date
}
```

### Charity Bucket

```js
{
  _id: ObjectId,
  company: { _id: ObjectId },
  name: String,
  description: String, // optional
  logo: String, // Logo for charity, URL, optional
  image: String, // URL, optional
  target: Number, // Integer, >= 0
  total: Number, // Current total coins in bucket
  donations: [{
    user: {
      _id: ObjectId,
      avatar: String,
      firstName: String,
      lastName: String
    },
    amount: Number, // Integer, > 0
    createdAt: Date
  }],
  autoClose: false, // Close the bucket (disallow purchases) when target is reached
  closed: false, // Bucket is closed for donations
  deleted: false,
  createdAt: Date
}
```

### Transaction Log

Records of changes to users' KudosCoins totals via purchases or distributions from corporate mods.

```js
{
  _id: ObjectId,
  user: {
    _id: ObjectId,
    avatar: String,
    firstName: String,
    lastName: String
  },
  kudosCoins: Number, // Integer, > 0 or < 0
  reason: String,
  type: String, // One of 'purchase', 'donation', 'distribution', 'daily-coin', 'activity' or 'activity-adjustment'
  createdAt: Date,
  createdBy: {
    _id: ObjectId,
    avatar: String,
    firstName: String,
    lastName: String
  },
  company: {
    _id: ObjectId,
    name: String
  },
  data: {
    // free-format object associated with transfer
  }
}
```

The possible `type`s are:

* `onboarding`
* `missingStats`
* `corpModInvite`
* `companyInvite`
* `indLeagueInvite`
* `groupLeagueInvite`
* `disconnectedMethod`

## Auth

We use [JSON web tokens](http://jwt.io/) for auth, provided by [Auth0](https://auth0.com):

* Secure authentication **without cookies**
  + No cookies means **no *annoying* cookie message** on your website
(see: [e-Privacy Directive](https://ico.org.uk/for-organisations/guide-to-pecr/cookies/))
* **Stateless** authentication (simplifies [_horizontal scaling_](http://en.wikipedia.org/wiki/Scalability#Horizontal_and_vertical_scaling))
* **Prevent** (mitigate) cross-Site Request Forgery (**CSRF**) attacks

[More information here](https://github.com/dwyl/learn-json-web-tokens).

### JWT

JSON web tokens sent to clients contain only a single field relevant to the application: "sub". This field contains an encrypted field (`auth0Id`) of the `User` object that identifies the user.

Tokens are created by Auth0 when clients log in to KudosHealth using Auth0 as an OAuth provider, so no password data needs to be stored within this app. Subsequent API calls with the provided JWT in their headers can be decoded and verified using the clientID and secret provided by Auth0 without requiring any further network requests, and the decoded `auth0Id` can then be used to retrieve the locally-stored user object.

### dailyStats

These documents are packets of statistics stored by the daily cron process for publication by the API.  Each of them has a `type` field.

**NOTE** - the `companyId` field will be `ALL` for stats which are generated for the entire Kudos community.

```js
var leagueStandings = {
  "type" : "leagueStandings",
  "date" : ISODate("2016-08-24T00:00:00Z"),
  "leagueName" : "collaborative evolve users",
  "leagueId" : ObjectId("57bd86d5f5f7e4632ae9159e"),
  "ranking" : 1,
  "name" : "Cary Ferry",
  "active" : true,
  "activated" : true,
  "startDate" : ISODate("2016-07-12T08:01:37.572Z"),
  "userId" :  ObjectId("57bd86d3f5f7e4632ae9111e"), // this is either the user doc _id or the team _id for group leagues
  "members": [ ObjectId("894h934h983n8408n3048304") ], // this is an array of one (individual league) or more (group league) user._ids
  "score" : 418.7,
  "rankingProgress" : 0
}

var groupStandings = {
  "type" : "groupStandings",
  "date" : ISODate("2016-08-24T00:00:00Z"),
  "companyId" : ObjectId("57bd86c0f5f7e4632ae910f8"),
  "title" : "Powlowski and Sons",
  "count" : 44,
  "standings" : [
    {
      "_id" : ObjectId("57bd86d3f5f7e4632ae91104"),
      "kudosPoints" : 529.4550337022273,
      "ranking" : 1,
      "percent" : 3
    },
    {
      "_id" : ObjectId("57bd86d3f5f7e4632ae9111f"),
      "kudosPoints" : 516.1214668754137,
      "ranking" : 2,
      "percent" : 5
    },
    ...
  ]
}

var companyLeaderboard = {
  "type" : "companyLeaderboard",
  "date" : ISODate("2016-08-24T00:00:00Z"),
  "companyId" : ObjectId("57bd86c0f5f7e4632ae910f8"),
  "leaderboard" : {
    "users" : {
      "all" : [
        {
          "name" : "Zita Emmerich",
          "points" : 529.4550337022273
        },
        {
          "name" : "Wallace Moen",
          "points" : 516.1214668754137
        },
        ...
      ],
      "week" : [
        {
          "name" : "Opal Mayert",
          "points" : 132.2153183276511
        },
        ...
      ],
      "month" : [ ... ]
    },
    "locations" : {
      "all" : [ ... ],
      "month" : [ ... ],
      "week": [ ... ],
    }
    "departments": {
      ...
    },
    "leagues": {
      ...
    }
  }
}

var companyRanking = {
  "type" : "companyRankings",
  "date" : ISODate("2016-08-24T00:00:00Z"),
  "globalRanking" : 1,
  "companyName" : "Ankunding, Roberts and Haag",
  "companyId" : ObjectId("57bd86c0f5f7e4632ae910fc"),
  "companyAvg" : 0.5004286352009667,
  "podium" : [
    {
      "_id" : ObjectId("57bd86d3f5f7e4632ae911ff"),
      "kudosPoints" : 107.85485051287988,
      "name" : "Bradley O'Kon",
      "image" : "https://placem.at/people?w=250&random=1472038612181"
    },
    {
      "_id" : ObjectId("57bd86d3f5f7e4632ae91206"),
      "kudosPoints" : 102.21917865395453,
      "name" : "Emelia Yundt",
      "image" : "https://placem.at/people?w=250&random=1472038612187"
    },
    {
      "_id" : ObjectId("57bd86d3f5f7e4632ae911a1"),
      "kudosPoints" : 101.01763857770172,
      "name" : "Stephen Jast",
      "image" : "https://placem.at/people?w=250&random=1472038611938"
    }
  ]
}

var companyStats = {
  "type" : "companyStats",
  "date" : ISODate("2016-08-24T00:00:00Z"),
  "name" : "Powlowski and Sons",
  "companyId" : ObjectId("57bd86c0f5f7e4632ae910f8"),
  "dem" : "all", // demographic - could be "Male" or "16-25", for example
  "kudosPoints" : 268.55377383062086  
}

var monthlyCompanyAverage = {
  "type" : "monthlyCompanyAverage",  
  "monthStart" : 1467331200000
  "name" : "Weber, Williamson and Watsica",
  "kudosPoints" : 59.16920204110941,
  "companyId" : ObjectId("57bd86c0f5f7e4632ae910fa"),
}

var globalStats = {
  "type" : "globalStats",
  "monthStart" : 1467331200000,
  "name" : "Weber, Williamson and Watsica",
  "monthlySum" : 1360.8916469455164,
  "activeUsers" : [
    23,
    23
  ],
  "companyId" : ObjectId("57bd86c0f5f7e4632ae910fa"),
  "globalRanking" : 1,
  "monthlyDiff" : 1360.8916469455164  
}
```

## Setting up an SSH tunnel to enable Auth0 login from localhost

Logging in from a dev server is tricky, because the Auth0 accounts have API hooks they need to run your details against in order to verify you as a user.  Obviously, this means exposing your local API server somehow.

A script is provided to do so, courtesy of the node module *localserver*.  It's somewhat fragile, so there's also a script which will automatically restart it after 5 seconds on exit.

```bash
> npm run tunnel # to open a tunnel at https://kudoshealthapi.localtunnel.me (which matches the API_URL Auth0 DB env variable for the KH dev account)
> npm run tunnel:forever # to open a tunnel with automatic restart
```

**NOTE 1** you only require the tunnel for login and registration - once Auth0 has provided a valid JWT, communication is all local.
**NOTE 2** since the localtunnel subdomain must be unique, this will only work for one person at a time.  If the script fails, check that nobody else is using it!

## Generating fake data

The command `npm run fake create-companies [n]` can be used to populate the database with fake companies, each of which has leagues, departments, locations and member users.  The users will have a random array of methods enabled from the available list, and one month's worth of intervals inserted consistent with these methods.  A corporate moderator (covering all created companies) with the login *corpmod@kudoshealth.com* will also be added, along with an admin user using *admin@kudoshealth.com*.  All of the created users will have the password *password*.

To create 10 fake companies (approximately 300 users):

```
npm run fake create-companies 10
```

The created data will also be dumped into `fake-data.json` in the project root for ease of reference.  To create 10 fake companies, clearing the database first:

```
npm run fake create-companies 10 -- --clear-db
```

**NOTE** this command will run on the live database you have specified in your main config (i.e. *not* the test DB).

## Run adhoc cron tasks

You can run any of the cron tasks from `/lib/cron-tasks` as an npm script.

```
npm run cron *nameOfYourTask*
```
