'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

test('invoice matches the placed order HSN tax and billed total', function () {
  const items = [{
    id: 1,
    name: 'Indrayani Basmati Rice 5kg',
    sku: 'GRN-001',
    hsn: '1006',
    price: 640,
    qty: 1
  }];
  const billed = pricing.computeTotals(items, '');
  const invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(billed.tax, 32);
  assert.equal(billed.total, 672);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.total, billed.total);
  assert.equal(invoiceFigures.rows[0].gstPercent, billed.lines[0].gstPercent);
  assert.equal(invoiceFigures.rows[0].lineTax, billed.lines[0].tax);
});

test('invoice uses the same HSN GST slab as order pricing', function () {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }];
  const billed = pricing.computeTotals(items, '');
  const invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: '' });
  assert.equal(billed.tax, 5);
  assert.equal(billed.total, 105);
  assert.equal(invoiceFigures.rows[0].gstPercent, billed.lines[0].gstPercent);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.cgst, billed.cgst);
  assert.equal(invoiceFigures.sgst, billed.sgst);
  assert.equal(invoiceFigures.total, billed.total);
});

test('invoice uses the order coupon discount and post-discount GST base', function () {
  const items = [{ id: 2, name: 'Rice', sku: 'RICE-2', hsn: '1006', price: 500, qty: 1 }];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.equal(billed.discount, 50);
  assert.equal(billed.tax, 22.5);
  assert.equal(billed.total, 472.5);
  assert.equal(invoiceFigures.discount, billed.discount);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.total, billed.total);
});

test('invoice does not apply a coupon below its configured minimum subtotal', function () {
  const items = [{ id: 3, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.equal(billed.discount, 0);
  assert.equal(invoiceFigures.discount, billed.discount);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.total, billed.total);
});

test('reconciliation matches the billed order and ignores cancelled orders', function () {
  const items = [{ id: 4, name: 'Rice', sku: 'RICE-4', hsn: '1006', price: 100, qty: 1 }];
  const billed = pricing.computeTotals(items, '');
  const db = {
    products: [],
    customers: [],
    orders: [
      {
        id: 44,
        date: '21/11/2026',
        customer: 'Walk-in',
        coupon: '',
        status: 'completed',
        items: items,
        subtotal: billed.subtotal,
        discount: billed.discount,
        tax: billed.tax,
        total: billed.total
      },
      {
        id: 45,
        date: '21/11/2026',
        status: 'cancelled',
        items: items,
        subtotal: billed.subtotal,
        discount: billed.discount,
        tax: billed.tax,
        total: billed.total
      }
    ]
  };

  const result = reports.getGstReconciliation(db);

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].orderId, 44);
  assert.equal(result.rows[0].ledgerTax, 5);
  assert.equal(result.rows[0].invoiceTax, 5);
  assert.equal(result.rows[0].ledgerTotal, 105);
  assert.equal(result.rows[0].invoiceTotal, 105);
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.rows[0].matched, true);
});
