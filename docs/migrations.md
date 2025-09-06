# Migrations & Seeding (Prisma)

Since this database if shared among candidates you do not have edit access, for obvious reasons. If your solution mandates that colums are to be added, we encourage you do create a local instance so you have complete control. When you do the final submission include this detail.

To create/alter tables, run migrations **against your own local database**. Treat this like a production db, only make changes that won't lose the original data.

### 1. Point Prisma to your own DB

Create a local database (MySQL) and set your `.env`:

```env
DATABASE_URL="mysql://root:password@localhost:3306/warden_local"
```

If the DB doesn’t exist yet, create it:

```sql
CREATE DATABASE warden_local;
```

### 2. Bring your local instance to the deault state

Generate the Prisma client (optional if you already did):

```bash
npx prisma generate

```

Apply default migrations to the database:

```bash
npx prisma migrate deploy
```

Seed data is available in the codebase. To run the seed script:

```bash
npm run db:seed
```

This makes sure that you local database is populate with the initial dataset. You can verify this bu running. Verify this by running the below command, it should be a non zero count.

```sql
SELECT count(*) from Property;

```

### 3. Create and Run Migrations

Make all the required changes in the `prisma.schema` file.

Create a new migration (replace `migration_name` with a meaningful name):

```bash
npx prisma migrate dev --name migration_name
```

Apply pending migrations to the database:

```bash
npx prisma migrate deploy
```
