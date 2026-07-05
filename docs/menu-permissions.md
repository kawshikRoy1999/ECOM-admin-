# Role-Based Menu Permissions — Reference

How the sidebar (and Ctrl-K command palette) is filtered per logged-in user's role.

## How it works

1. **At login**, after `GetCompany`, the app calls:
   - `UserManagement/MenuActions { UserId }` → `permittedMenus[]` (`{menuId, parentMenuId, menuName, url, isDefault}`) + `permittedActions[]` (what the role is granted), and
   - `UserManagement/GetMenuList { CompanyId, … }` → the **full company menu master** (every menu the permission system manages).
   Both are stored on the session.
2. Each sidebar item is mapped to one or more **tokens** (see table below).
3. Decision for each item (tokens matched case-insensitively against a menu's **`menuName` only** — the .NET `url` values are MVC routes that don't map to Angular routes, so `url` is **ignored**):
   - If the item's token is **not in the menu master** → **show it** (it isn't managed by permissions / not in the DB — e.g. newer modules).
   - If the item's token **is in the master** → show it only if it's also in the role's **`permittedMenus`**; otherwise **hide** it.
4. A nav **group** disappears automatically when all of its items are hidden.

> This is the key rule you asked for: **things that aren't in the permission database default to VISIBLE.** Only menus that the DB actually manages get turned off when the role lacks them.

### Fail-open rules (menu is always ON)

The menu is **not** filtered (everything shows) when:

- the user is a **super admin** (`isSuperAdmin = true`), or
- the session has **no `permittedMenus`** (empty list, older session, or `MenuActions` failed), or
- the **menu master couldn't be loaded** (`GetMenuList` failed/empty) — without it we can't tell denied from not-in-DB, so nothing is hidden.

Filtering only turns a menu OFF when the master is known, the menu is in it, and the role isn't granted it.

---

## Menu → permission token map

An item shows if a permitted menu's **name or url contains** any listed token (case-insensitive).

| Nav group | Menu item | Route | Tokens (any match → shown) |
|-----------|-----------|-------|----------------------------|
| Overview | Dashboard | `/dashboard` | `dashboard` |
| Catalog | Items & Inventory | `/catalog/items` | `item`, `inventory` |
| Catalog | Categories & Brands | `/catalog/categories` | `category`, `brand` |
| Catalog | Review Approval | `/catalog/reviews` | `review` |
| Sales | Orders | `/orders` | `order` |
| Marketing | Offers | `/offers` | `offer` |
| Marketing | Banners | `/settings/banners` | `banner` |
| Reports | Batch Report | `/reports/batch` | `batch` |
| Store Setup | Locations | `/settings/locations` | `location` |
| Store Setup | Taxes | `/settings/taxes` | `tax` |
| Store Setup | Zones | `/settings/zones` | `zone` |
| Design & Layout | Store Front Template | `/settings/templates` | `template`, `storefront` |
| Design & Layout | Invoice Template | `/settings/invoice-template` | `invoice` |
| Design & Layout | Order Template | `/settings/order-template` | `ordertemplate` |
| Access Control | Users | `/access/users` | `user` |
| Access Control | Roles | `/access/roles` | `role` |
| Access Control | Permissions | `/access/permissions` | `permission` |
| System Settings | Company | `/settings/company` | `company` |
| System Settings | Notifications | `/settings/notifications` | `notification` |
| System Settings | Social Links | `/settings/social` | `social` |
| System Settings | Order Statuses | `/settings/statuses` | `status`, `cancellation` |

> The token map lives in `src/app/layout/admin-layout.ts` (`menuTokens`). The matching logic is `AuthService.canAccess()` in `src/app/core/auth/auth.service.ts`.

---

## "Which permission turns which menu OFF?"

Removing a menu from a role's permitted list (in the Permissions matrix) turns off the corresponding sidebar item(s):

| If the role is NOT permitted a menu whose name/url contains… | …these sidebar item(s) turn OFF |
|---|---|
| `dashboard` | Dashboard |
| `item` / `inventory` | Items & Inventory |
| `category` / `brand` | Categories & Brands |
| `review` | Review Approval |
| `order` | Orders |
| `offer` | Offers |
| `banner` | Banners |
| `batch` | Batch Report |
| `location` | Locations |
| `tax` | Taxes |
| `zone` | Zones |
| `template` / `storefront` | Store Front Template |
| `invoice` | Invoice Template |
| `ordertemplate` | Order Template |
| `user` | Users |
| `role` | Roles |
| `permission` | Permissions |
| `company` | Company |
| `notification` | Notifications |
| `social` | Social Links |
| `status` / `cancellation` | Order Statuses |

When **every** item in a group is off, the whole group header disappears (e.g. no `user`/`role`/`permission` menus → the **Access Control** group is hidden).

---

## ⚠️ Important: tokens must match your real menu data

The tokens above are **best-guess** matches against the `menuName` / `url` values your gateway returns from `MenuActions`. They are correct **only if** your DB menu names/urls actually contain these substrings.

**To verify / correct:** log in as a limited-role user, capture the `UserManagement/MenuActions` response, and check each menu's `menuName` and `url`. If a menu you expect to control an item does **not** contain the mapped token, update `menuTokens` in `admin-layout.ts`.

Example — if your "Items & Inventory" menu comes back as:
```json
{ "menuName": "Inventory Item", "url": "InventoryItem/Index" }
```
then token `item` already matches (`inventoryitem` contains `item`) ✅. But if it came back as `{ "menuName": "Products", "url": "Product/List" }`, you'd need to add `product` to that row's tokens.

---

## Known limitations (current state)

- **Menu display only** — the sidebar and command palette are filtered, but there is **no route guard**: typing a URL directly still reaches the page. (Deferred to avoid lockouts until tokens are validated.)
- **No per-action gating** — `permittedActions` (Add / Edit / Delete) is fetched and stored but not yet used to hide buttons inside a page.
- **Super admins & permission-less sessions see everything** (fail-open, by design).
