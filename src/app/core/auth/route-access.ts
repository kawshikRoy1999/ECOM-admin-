/**
 * Role-based page access, ported from the .NET admin.
 *
 * The .NET app gates each page in its controller with one MenuActionId
 * (`user.PermittedActions.Any(x => x.MenuActionId == ...)`, else "DataNotAvailable"),
 * and shows the Settings area only when the role has the "Setting" menu.
 * Those exact ids are reused here so a role sees the same pages in both apps.
 *
 * `action`  – a MenuActionId the role must hold (from PermittedActions).
 * `menu`    – a MenuId the role must hold (from PermittedMenus).
 * When both are set, both are required.
 * No rule   – open to every signed-in user (the .NET page had no check either).
 */
export interface RouteAccessRule {
  action?: string;
  menu?: string;
}

/** .NET "Setting" menu (parent of Users / Roles / Permission / Invoice Template). */
export const SETTING_MENU_ID = '42d7d906-a0c5-4308-a932-72235bea00e4';

const A = {
  itemList: '144a574b-52a0-4916-87b7-9376c0cce985', // ItemController.Index
  itemAddEdit: 'cdb3188d-cdcf-476b-80f1-02613d1ababf', // ItemController.AddEditItem
  categoryBrand: 'cc3685d2-e9d8-4ede-b38c-c1cf338a3add', // CategoryBrandController.Index
  orders: 'b51b2109-f9e6-4860-899f-b8776bc40e94', // OrderController.Index
  orderDetail: '01530ca2-6717-4d1f-aa32-11a57df1fd8e', // OrderController._PartialOrderDetailsNew
  users: '0927c301-a1d2-4b36-b215-2841a5773851', // SettingController.Users
  roles: 'aba0d932-6f24-466d-92f4-a207becad32f', // SettingController.Role
  permissions: 'c70daef0-aee9-4658-91ff-5ddf4ab5c5b6', // SettingController.Permission
  company: 'a1d18147-995b-449b-979b-418fa8c17e2a', // CompanyController.Index
  templates: '3131a168-2cb8-4d95-894a-79871820b975', // SettingController.InvoiceTemplate / OrderTemplate
};

/** Longest matching prefix wins (so /orders/123 uses the order-detail rule). */
export const ROUTE_ACCESS: { prefix: string; rule: RouteAccessRule }[] = [
  { prefix: '/catalog/items/', rule: { action: A.itemAddEdit } },
  { prefix: '/catalog/items', rule: { action: A.itemList } },
  { prefix: '/catalog/categories', rule: { action: A.categoryBrand } },
  // .NET always lists "Item Review Approval" under the Inventory menu
  { prefix: '/catalog/reviews', rule: { action: A.itemList } },
  { prefix: '/orders/', rule: { action: A.orderDetail } },
  { prefix: '/orders', rule: { action: A.orders } },
  { prefix: '/access/users', rule: { action: A.users, menu: SETTING_MENU_ID } },
  { prefix: '/access/roles', rule: { action: A.roles, menu: SETTING_MENU_ID } },
  { prefix: '/access/permissions', rule: { action: A.permissions, menu: SETTING_MENU_ID } },
  { prefix: '/settings/company', rule: { action: A.company } },
  { prefix: '/settings/invoice-template', rule: { action: A.templates, menu: SETTING_MENU_ID } },
  { prefix: '/settings/order-template', rule: { action: A.templates, menu: SETTING_MENU_ID } },
  // Users / Roles / Permission / Invoice Template are children of the .NET Setting menu, so they need it too.
  // Everything else under Settings (and Offers/Banners, which live in .NET Settings) needs the Setting menu.
  { prefix: '/settings/', rule: { menu: SETTING_MENU_ID } },
  { prefix: '/offers', rule: { menu: SETTING_MENU_ID } },
];

export function ruleFor(url: string): RouteAccessRule | null {
  const path = (url.split(/[?#]/)[0] || '/').toLowerCase();
  let best: { prefix: string; rule: RouteAccessRule } | null = null;
  for (const r of ROUTE_ACCESS) {
    const p = r.prefix.toLowerCase();
    const hit = p.endsWith('/') ? path.startsWith(p) && path.length > p.length : path === p || path.startsWith(p + '/');
    if (hit && (!best || p.length > best.prefix.length)) best = r;
  }
  return best ? best.rule : null;
}
