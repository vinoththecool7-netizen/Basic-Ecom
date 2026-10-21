# Everyday carry

A local React recreation of [E-commerce 04 by Mohammad Shehadeh / Hirael](https://21st.dev/@mohammadshehadeh/components/ecommerce-04), based on the supplied MIT-licensed source.

### One-command startup (new setup or restart)

Install **Node.js 24 or newer**, open a terminal in this project's folder (the folder containing `package.json`), and paste this single command:

```sh
npm ci --include=dev && npm run build && npm start
```

This installs the locked dependencies, builds the frontend, and starts **both the website and its SQLite database**. SQLite runs inside the app, so no separate database server, Docker container, or SQL installation is needed. Keep the terminal running; press `Ctrl+C` to stop. Run the same command again to resume.

**Your data persists across stops, restarts, dependency installs, and rebuilds** in `var/inventory.sqlite`. Startup creates the database and sample catalog only when needed; it preserves existing products, stock, orders, and admin accounts.

**Moving to another computer:** stop the app on the old computer, then copy the entire `var/` folder along with the project into the new setup **before running the command**. `var/` is intentionally excluded from Git, so cloning or copying source code alone will not transfer your existing database. Without that folder, the new setup starts with a fresh database. Keep a backup of `var/`; do not delete it when updating the code. If you previously set `DATABASE_PATH`, transfer that database location instead.

Requires **Node.js 24 or newer**. Open [the shop](http://127.0.0.1:5173/) or [the admin workspace](http://127.0.0.1:5173/admin). Everything runs locally, with no ChatGPT Sites dependency.

The first visit to `/admin` asks you to create your admin account. Use your own email and a password of at least 12 characters. Later visits show the sign-in form. There is no default password. Sessions expire after eight hours, passwords use salted scrypt hashes, and sign-in attempts are rate limited.

The storefront includes the original 12 products and filters, collection search, category navigation, product details, related products, a persistent shopping bag, guest checkout, and order confirmation. Checkout accepts **pay on delivery**; it does not charge cards, send email, calculate regional tax, or book shipping. Standard shipping is $8 and becomes free at $200. All prices are USD. The original product ratings and reviews are sample catalog data.

The admin workspace includes:

- Inventory totals, available units, low-stock indicators, and retail stock value.
- Product creation and editing, prices, descriptions, quantities, low-stock thresholds, and catalog image selection.
- Reversible product archiving, category filters, search, and CSV export of the current inventory view.
- A history of stock adjustments and the latest 200 orders.
- Order processing, shipping, delivery, and cancellation. Cancelling an unshipped order restores stock exactly once.

The storefront reads inventory from the database and refreshes it every 30 seconds and when the window regains focus. Checkout always checks the latest database stock and prices. Stock deductions, order records, and stock history save in one SQL transaction. Retry keys prevent duplicate orders. Product revisions prevent stale admin forms from overwriting newer edits.

### Database

The actual SQLite database is created automatically at `var/inventory.sqlite`. Its table definitions are in [server/schema.sql](server/schema.sql): `products`, `admins`, `sessions`, `login_attempts`, `orders`, `order_items`, and `stock_movements`. No external SQL service or credentials are needed. Sample starting quantities seed once and are not reset on restart; update them in the admin before using real inventory. Product photos are in `public/images/`.

The database contains admin credentials and customer delivery information. It is excluded from Git and HTTP access. To back it up, stop the server and copy the entire `var/` directory. Keep it when upgrading the app. An alternate path can be supplied with `DATABASE_PATH`.

### Build and run

Use the one-command startup above. For development with live frontend updates, run `npm run dev` after installing dependencies; it uses the same persistent database.

`npm start` serves the built frontend and the same SQL backend on `http://127.0.0.1:5173`. `npm run preview` is an alias. `PORT` can change the port. The server intentionally binds to loopback: this is a working local store, not a public deployment. A public launch would need HTTPS, an appropriate hosting and database backup setup, and your payment, tax, email and delivery configuration.

### Tests

```sh
npm test
```

Integration tests use disposable SQLite databases and local HTTP servers. They cover account setup, login/logout and expiry, request origins, rate limiting, product validation, optimistic locking, archiving, stock auditing, correct checkout pricing, idempotent retries, simultaneous orders, transactional stock updates, cancellation, fulfilment transitions, and persistence after restart. Tests never change the real store database.

Original component: MIT · Mohammad Shehadeh · https://github.com/MohammadShehadeh/hirael. Product photos originate from https://hirael.com/media/blocks/ecommerce-04/.
