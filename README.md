# Commerce7 Zapier Plugin

This is a Zapier plugin for the Commerce7 API.

## Available triggers

- Customer Created: instant Commerce7 webhook trigger.
- Customer Updated: instant webhook trigger, including bulk tag updates.
- Club Package Created: instant Commerce7 webhook trigger.
- Reservation Cancelled or Deleted: instant trigger covering both status updates and deletes.
- New Reservation: emits reservation records when they are created or updated.
- Closed Reservation: emits reservation records when their status changes to `Closed`.
- New Customer: emits customer records when they are first created in Commerce7.

## Available searches

- Find Customer by ID, email, or phone.
- Find Order or Reservation by ID.
- Find Club Membership by ID or all memberships for a customer.
- Find Club Package by ID.

## Available actions

- Create or update a customer.
- Add or remove a customer tag.
- Add a customer note.
- Update customer custom fields from a JSON object.

## Deploy to Zapier

This integration is a Zapier CLI app. Deployment is done with the Zapier Platform CLI.

### Prerequisites

- A Zapier developer account with access to the integration.
- Commerce7 API credentials for the shared server-side auth used by this app:
    - `C7_API_USERNAME`
    - `C7_API_TOKEN`
- The installed Commerce7 app version must grant:
    - Customer: Full
    - Reservation: Full
    - Order: Read
    - Club Membership: Read
    - Club Package: Read
    - Tag: Full
    - Note: Full
    - WebHook: Full
- Node/npm installed locally.

### 1. Install dependencies

```bash
npm install
```

### 2. Install the Zapier CLI

Install it globally:

```bash
npm install -g zapier-platform-cli
```

Or run it ad hoc with `npx zapier-platform-cli ...`.

### 3. Log in to Zapier

```bash
zapier-platform login
```

This will configure your deploy key locally.

### 4. Link or register the integration

If the integration already exists in Zapier, run this from the repo root:

```bash
zapier-platform link
```

If this is the first time creating it in Zapier, run:

```bash
zapier-platform register
```

### 5. Test and validate locally

```bash
npm test
zapier-platform validate
```

The normal test suite is self-contained and does not contact Commerce7.

### Live staging integration tests

An opt-in suite verifies authentication, searches, actions, webhook management,
and the complete customer/reservation trigger lifecycle against a Commerce7
staging tenant. It creates uniquely named fixtures, disables transaction emails,
and deletes the fixtures when finished.

Configure `C7_API_USERNAME` and `C7_API_TOKEN` in `.env`, then run:

```bash
C7_TEST_TENANT_ID=staging-corollary-wines npm run test:integration
```

The suite refuses to write to a tenant whose ID does not contain `staging`.
Keep this suite out of ordinary pull-request runs; use it manually or in a
scheduled, serial CI job with protected secrets.

### 6. Push a new Zapier version

```bash
zapier-platform push
```

`push` builds the app and uploads a new Zapier version.

### 7. Set Commerce7 environment variables on the pushed version

Environment variables are version-specific in Zapier CLI. After pushing, set them on the version you just created:

```bash
zapier-platform env:set 1.0.0 C7_API_USERNAME=your-username C7_API_TOKEN=your-token
```

Replace `1.0.0` with the version you just pushed.

If you need to inspect versions first:

```bash
zapier-platform versions
```

If you need to inspect the environment for a version:

```bash
zapier-platform env:get 1.0.0
```

### 8. Promote the version when ready

For private testing only, `push` is enough.

To make a version the current public version:

```bash
zapier-platform promote 1.0.0
```

Promotion does not upload code by itself. The normal release flow is:

```bash
zapier-platform validate
zapier-platform push
zapier-platform env:set 1.0.0 C7_API_USERNAME=your-username C7_API_TOKEN=your-token
zapier-platform promote 1.0.0
```

### Notes

- End users still provide their own Commerce7 `tenant_id` when connecting the app in Zapier.
- The shared Commerce7 username/token are read from Zapier environment variables by the authentication layer in `authentication.js`.
- The current CLI warns that the old `zapier` command name is deprecated. Use `zapier-platform` going forward.

This is unsupported, but you're welcome to fork and submit pull requests.

I don't do tech support, but if you have questions, contact dan AT corollarywines.com.
