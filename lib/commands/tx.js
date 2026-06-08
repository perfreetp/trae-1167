const chalk = require('chalk');
const { requireInit, readJson, writeJson, addLog, generateId, today, MOLDS_FILE, TRANSACTIONS_FILE } = require('../utils');

exports.describe = '流转记录管理（更正/补录）';

var EDITABLE_FIELDS = {
  person: '领用人',
  expectedReturnDate: '预计归还日期',
  usageCount: '使用模次',
  outRemark: '出库备注',
  returnRemark: '归还备注',
  returnDate: '归还日期'
};

function handleEdit(id, opts) {
  requireInit();
  opts = opts || {};

  var transactions = readJson(TRANSACTIONS_FILE) || [];
  var idx = transactions.findIndex(function (t) { return t.id === id; });
  if (idx === -1) {
    console.error(chalk.red('未找到流转记录: ' + id));
    process.exit(1);
  }

  var tx = transactions[idx];
  var changes = [];

  Object.keys(EDITABLE_FIELDS).forEach(function (field) {
    if (opts[field] === undefined || opts[field] === null) return;
    var newVal = opts[field];
    if (field === 'usageCount') {
      newVal = parseInt(newVal, 10);
      if (isNaN(newVal)) return;
    }
    var oldVal = tx[field] || '';
    if (String(oldVal) !== String(newVal)) {
      changes.push({ field: field, label: EDITABLE_FIELDS[field], oldVal: oldVal, newVal: newVal });
      tx[field] = newVal;
    }
  });

  if (changes.length === 0) {
    console.log(chalk.yellow('未指定修改内容或值未变化'));
    return;
  }

  if (opts.returnDate && tx.status === 'open') {
    tx.status = 'returned';
    changes.push({ field: 'status', label: '状态', oldVal: 'open', newVal: 'returned' });
  }

  transactions[idx] = tx;
  writeJson(TRANSACTIONS_FILE, transactions);

  var usageDiff = 0;
  changes.forEach(function (c) {
    if (c.field === 'usageCount') {
      var oldNum = parseInt(c.oldVal, 10) || 0;
      var newNum = parseInt(c.newVal, 10) || 0;
      usageDiff = newNum - oldNum;
    }
  });

  if (usageDiff !== 0) {
    var molds = readJson(MOLDS_FILE) || [];
    var moldIdx = molds.findIndex(function (m) { return m.code === tx.moldCode; });
    if (moldIdx !== -1) {
      molds[moldIdx].usedCount = Math.max(0, molds[moldIdx].usedCount + usageDiff);
      molds[moldIdx].updatedAt = new Date().toISOString();
      writeJson(MOLDS_FILE, molds);
    }
  }

  var changeDesc = changes.map(function (c) { return c.label + ': ' + c.oldVal + ' → ' + c.newVal; }).join(', ');
  addLog('tx:edit', '更正流转单 ' + id + ': ' + changeDesc, tx.moldCode);

  console.log(chalk.green('✔ 流转单 ' + id + ' 已更正 ' + changes.length + ' 个字段:'));
  changes.forEach(function (c) {
    console.log(chalk.gray('  ' + c.label + ': ' + c.oldVal + ' → ' + c.newVal));
  });
}

function handleAdd(code, opts) {
  requireInit();
  opts = opts || {};

  var molds = readJson(MOLDS_FILE) || [];
  var mold = molds.find(function (m) { return m.code === code; });
  if (!mold) {
    console.error(chalk.red('未找到模具: ' + code));
    process.exit(1);
  }

  var person = opts.person || '';
  var outDate = opts.outDate || '';
  var returnDate = opts.returnDate || '';
  var usageCount = opts.usageCount ? parseInt(opts.usageCount, 10) : 0;
  var expectedReturn = opts.expectedReturn || '';
  var outRemark = opts.outRemark || '';
  var returnRemark = opts.returnRemark || '';

  if (!person) {
    console.error(chalk.red('请指定领用人: -p / --person'));
    process.exit(1);
  }
  if (!outDate) {
    console.error(chalk.red('请指定出库日期: --out-date'));
    process.exit(1);
  }

  var txId = generateId();
  var status = returnDate ? 'returned' : 'open';

  var transaction = {
    id: txId,
    moldCode: code,
    moldName: mold.name || '',
    person: person,
    outDate: outDate,
    expectedReturnDate: expectedReturn,
    usageCount: usageCount,
    outRemark: outRemark,
    status: status,
    returnDate: returnDate,
    returnRemark: returnRemark,
    createdAt: new Date().toISOString()
  };

  var transactions = readJson(TRANSACTIONS_FILE) || [];
  transactions.push(transaction);
  writeJson(TRANSACTIONS_FILE, transactions);

  addLog('tx:add', '补录流转: ' + code + ', 出库: ' + outDate + (returnDate ? ', 归还: ' + returnDate : '') + ', 领用人: ' + person, code);

  console.log(chalk.green('✔ 已补录流转记录: ' + code));
  console.log(chalk.gray('  流转单号: ' + txId));
  console.log(chalk.gray('  出库日期: ' + outDate));
  console.log(chalk.gray('  领用人:   ' + person));
  if (returnDate) {
    console.log(chalk.gray('  归还日期: ' + returnDate));
  }
  if (usageCount > 0) {
    console.log(chalk.gray('  使用模次: ' + usageCount));
  }
}

exports.handleEdit = handleEdit;
exports.handleAdd = handleAdd;
