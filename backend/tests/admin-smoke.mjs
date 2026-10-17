import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const base = 'http://127.0.0.1:4000';
async function call(path, method = 'GET', body, token) {
  const response = await fetch(base + path, {
    method, headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { status: response.status, data: await response.json() };
}
const temporary = mkdtempSync(join(tmpdir(), 'kasra-admin-ci-'));
const ownerPassword = randomBytes(32).toString('hex');
const staffPassword = randomBytes(24).toString('hex');
try {
  const file = join(temporary, 'owner-pass');
  writeFileSync(file, ownerPassword + '\n', { mode: 0o600 });
  const bootstrap = spawnSync(process.execPath, ['dist/admin/bootstrap.js', 'owner_ci', file], { encoding: 'utf8' });
  assert.equal(bootstrap.status, 0, 'Owner bootstrap failed: ' + bootstrap.stderr);
  assert.equal((await call('/v1/admin/staff')).status, 401);
  assert.equal((await call('/v1/admin/products')).status, 401);
  assert.equal((await call('/v1/admin/stock', 'PUT', { productId: 'manto-01' })).status, 404,
    'Legacy API-key inventory route should be disabled by default');

  const ownerLogin = await call('/v1/admin/auth/login', 'POST', { username: 'owner_ci', password: ownerPassword });
  assert.equal(ownerLogin.status, 200);
  const owner = ownerLogin.data.token;
  assert.match(owner, /^[a-f0-9]{64}$/);
  assert.equal(ownerLogin.data.user.role, 'owner');

  const existingOrders = (await call('/v1/admin/orders', 'GET', undefined, owner)).data.items;
  const codOrder = existingOrders.find(item => item.status === 'confirmed_cod');
  assert.ok(codOrder, 'CI smoke test should have created a COD order');
  assert.equal((await call('/v1/admin/orders/' + codOrder.id + '/status', 'PATCH',
    { status: 'preparing' })).status, 401);
  assert.equal((await call('/v1/admin/orders/' + codOrder.id + '/status', 'PATCH',
    { status: 'preparing' }, owner)).status, 200);
  assert.equal((await call('/v1/admin/orders/' + codOrder.id + '/status', 'PATCH',
    { status: 'delivered' }, owner)).status, 409, 'Cannot skip fulfillment stages');

  const created = await call('/v1/admin/staff', 'POST', {
    username: 'staff_ci', displayName: 'کارمند آزمایشی', password: staffPassword, role: 'staff'
  }, owner);
  assert.equal(created.status, 201);
  const staffId = created.data.user.id;

  const staffLogin = await call('/v1/admin/auth/login', 'POST', { username: 'staff_ci', password: staffPassword });
  assert.equal(staffLogin.status, 200);
  const staff = staffLogin.data.token;
  assert.equal((await call('/v1/admin/staff', 'GET', undefined, staff)).status, 403);
  assert.equal((await call('/v1/admin/products/manto-01/price', 'PATCH', { price: 1000 }, staff)).status, 403);
  assert.equal((await call('/v1/admin/orders', 'GET', undefined, staff)).status, 200);

  const elevated = await call('/v1/admin/staff/' + staffId, 'PATCH', {
    grants: ['products:price']
  }, owner);
  assert.equal(elevated.status, 200);
  assert.equal((await call('/v1/admin/auth/me', 'GET', undefined, staff)).status, 401,
    'Changing employee access must revoke existing sessions');

  const newLogin = await call('/v1/admin/auth/login', 'POST', { username: 'staff_ci', password: staffPassword });
  assert.equal(newLogin.status, 200);
  const currentPrice = (await call('/v1/admin/products', 'GET', undefined, owner)).data.items
    .find(item => item.id === 'manto-01').price;
  const priceChange = await call('/v1/admin/products/manto-01/price', 'PATCH', { price: currentPrice + 1 }, newLogin.data.token);
  assert.equal(priceChange.status, 200);
  // Restore the original value on the ephemeral CI database.
  assert.equal((await call('/v1/admin/products/manto-01/price', 'PATCH', { price: currentPrice }, owner)).status, 200);
  const audit = await call('/v1/admin/audit', 'GET', undefined, owner);
  assert.equal(audit.status, 200);
  assert.ok(audit.data.items.some(entry => entry.action === 'products.price'));


  // Product/image CRUD security and transactional lifecycle on ephemeral CI database.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9focP0sAAAAASUVORK5CYII=', 'base64');
  const invalidUpload = await fetch(base + '/v1/admin/media', {
    method: 'POST', headers: { 'Content-Type': 'image/png' }, body: png
  });
  assert.equal(invalidUpload.status, 401, 'Media uploads require staff authentication');
  const wrongMime = await fetch(base + '/v1/admin/media', {
    method: 'POST', headers: { Authorization: 'Bearer ' + owner, 'Content-Type': 'image/jpeg' }, body: png
  });
  assert.equal(wrongMime.status, 415, 'The claimed MIME and file signature must agree');
  const upload = await fetch(base + '/v1/admin/media', {
    method: 'POST', headers: { Authorization: 'Bearer ' + owner, 'Content-Type': 'image/png' }, body: png
  });
  assert.equal(upload.status, 201, 'Owner can upload PNG: ' + upload.status);
  const { url: imageUrl } = await upload.json();
  assert.match(imageUrl, /^\/api\/media\/[a-f0-9-]{36}\.png$/);
  const publicImage = await fetch(base + '/v1/media/' + imageUrl.split('/').at(-1));
  assert.equal(publicImage.status, 200);
  assert.equal(Buffer.compare(Buffer.from(await publicImage.arrayBuffer()), png), 0);
  assert.equal((await call('/v1/media/../../etc/passwd')).status, 404);

  const product = {
    id: 'ci-dress-01', slug: 'ci-dress-01', name: 'لباس مخصوص تست',
    category: 'manto', description: 'لباس نمونه برای تست مستقل مدیریت محصولات',
    price: 700000, compareAt: null, images: [imageUrl],
    colors: [{ id: 'black', name: 'مشکی', hex: '#000000' }],
    sizes: ['M'], variants: [{ colorId: 'black', size: 'M', stock: 3 }],
    material: 'کتان', fit: 'آزاد', care: 'شست‌وشو با آب سرد', featured: false
  };
  assert.equal((await call('/v1/admin/products', 'POST', product)).status, 401);
  assert.equal((await call('/v1/admin/products', 'POST', {
    ...product, variants: [...product.variants, ...product.variants]
  }, owner)).status, 400, 'Duplicate SKU pairs must be rejected');

  const createdProduct = await call('/v1/admin/products', 'POST', product, owner);
  assert.equal(createdProduct.status, 201, JSON.stringify(createdProduct.data));
  assert.equal(createdProduct.data.active, false, 'New products start unpublished');
  assert.equal((await call('/v1/products/ci-dress-01')).status, 404);
  const full = await call('/v1/admin/products/ci-dress-01', 'GET', undefined, owner);
  assert.equal(full.status, 200);
  assert.equal(full.data.item.images[0], imageUrl);
  assert.equal(full.data.item.variants.length, 1);
  assert.equal((await call('/v1/admin/products/ci-dress-01', 'PUT', { ...product, price: 800000 })).status, 401);
  assert.equal((await call('/v1/admin/products/ci-dress-01', 'PUT',
    { ...product, name: 'لباس نمونه تست ویرایش‌شده', price: 800000,
      sizes: ['M', 'L'], variants: [...product.variants, {colorId:'black',size:'L',stock:2}] },
    owner)).status, 200);
  assert.equal((await call('/v1/admin/products/ci-dress-01/visibility',
    'PATCH', { active: true }, owner)).status, 200);
  const published = await call('/v1/products/ci-dress-01');
  assert.equal(published.status, 200);
  assert.equal(published.data.price, 800000);
  assert.equal(published.data.variants.length, 2);
  const orderOptions = {
    items: [{ productId: 'ci-dress-01', colorId: 'black', size: 'M', quantity: 1 }],
    fields: { name: 'مشتری آزمایشی', mobile: '09123456789', province: 'تهران', city: 'تهران',
      address: 'خیابان آزادی پلاک آزمایشی ۱۲', postal: '1234567890', notes: '' },
    shipping: 'courier', payment: 'cod', code: ''
  };
  const orderResponse = await fetch(base + '/v1/orders', {
    method: 'POST', headers: {'Content-Type': 'application/json',
      'Idempotency-Key':'admin-ci-dress-0000001'}, body: JSON.stringify(orderOptions)
  });
  assert.equal(orderResponse.status, 201, 'Published item can be purchased');
  const productOrder = await orderResponse.json();
  assert.equal((await call('/v1/admin/products/ci-dress-01/visibility',
    'PATCH', { active: false }, owner)).status, 200);
  assert.equal((await call('/v1/products/ci-dress-01')).status, 404);
  const receipt = await call('/v1/orders/' + productOrder.id, 'GET', undefined, productOrder.accessToken);
  assert.equal(receipt.status, 200, 'Archiving does not destroy historical receipts');
  const archiveOrder = await fetch(base + '/v1/orders', {
    method: 'POST', headers: {'Content-Type': 'application/json',
      'Idempotency-Key':'admin-ci-dress-0000002'}, body: JSON.stringify(orderOptions)
  });
  assert.equal(archiveOrder.status, 422, 'Archived item cannot be ordered');
  console.log('Product CRUD, image upload, archive, and order history smoke tests passed');


  const disabled = await call('/v1/admin/staff/' + staffId, 'PATCH', { active: false }, owner);
  assert.equal(disabled.status, 200);
  assert.equal((await call('/v1/admin/auth/login', 'POST', { username: 'staff_ci', password: staffPassword })).status, 401);
  console.log('Admin RBAC, password sessions, price guard and audit smoke test passed');
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
