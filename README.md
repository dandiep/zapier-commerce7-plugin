# Commerce7 Zapier Plugin

This is a Zapier plugin for the Commerce7 API.

## Available triggers
- New Reservation: emits reservation records when they are created or updated.
- Closed Reservation: emits reservation records when their status changes to `Closed`.
- New Customer: emits customer records when they are first created in Commerce7.

## Deploy to Zapier

This integration is a Zapier CLI app. Deployment is done with the Zapier Platform CLI.

### Prerequisites

- A Zapier developer account with access to the integration.
- Commerce7 API credentials for the shared server-side auth used by this app:
  - `C7_API_USERNAME`
  - `C7_API_TOKEN`
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