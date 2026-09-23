# TRACY environment

TRACY requires PostgreSQL.

## Required

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/tracy?sslmode=require"
```

After configuring the database:

```bash
npm install
npm run db:push
npm run check
npm run dev
```

For deployment, configure `DATABASE_URL` in the hosting provider before the production build/runtime is used.

Restricted/private-source connectors are not enabled in the development build. The Finance Lab uses synthetic records only.
