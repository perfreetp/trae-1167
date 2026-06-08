const chalk = require('chalk');
const { requireInit, readJson, writeJson, addLog, MOLDS_FILE } = require('../utils');

var EDITABLE_FIELDS = {
  name: '名称',
  customer: '客户',
  location: '库位',
  category: '分类',
  lifespan: '设计寿命',
  drawingNo: '图纸编号',
  price: '采购价格',
  purchaseDate: '采购日期'
};

exports.describe = '修改模具基础信息';

exports.handler = function (code, opts) {
  requireInit();

  opts = opts || {};

  var molds = readJson(MOLDS_FILE) || [];
  var idx = molds.findIndex(function (m) { return m.code === code; });
  if (idx === -1) {
    console.error(chalk.red('未找到模具: ' + code));
    process.exit(1);
  }

  var changes = [];
  var mold = molds[idx];

  Object.keys(EDITABLE_FIELDS).forEach(function (field) {
    if (opts[field] !== undefined && opts[field] !== null) {
      var newVal = opts[field];
      if (field === 'lifespan' || field === 'price') {
        newVal = parseFloat(newVal);
        if (isNaN(newVal)) return;
      }
      var oldVal = mold[field];
      if (String(oldVal) !== String(newVal)) {
        changes.push({ field: field, label: EDITABLE_FIELDS[field], oldVal: oldVal, newVal: newVal });
        mold[field] = newVal;
      }
    }
  });

  if (changes.length === 0) {
    console.log(chalk.yellow('没有需要修改的字段'));
    return;
  }

  mold.updatedAt = new Date().toISOString();
  writeJson(MOLDS_FILE, molds);

  var detailParts = changes.map(function (c) {
    return c.label + ': ' + (c.oldVal === '' || c.oldVal === undefined ? '(空)' : c.oldVal) + ' → ' + c.newVal;
  });
  addLog('edit', '修改模具 ' + code + ': ' + detailParts.join(', '), code);

  console.log(chalk.green('✔ 模具 ' + code + ' 已更新 ' + changes.length + ' 个字段:'));
  changes.forEach(function (c) {
    console.log(chalk.gray('  ' + c.label + ': ' + (c.oldVal === '' || c.oldVal === undefined ? '(空)' : c.oldVal) + ' → ' + c.newVal));
  });
};

exports.EDITABLE_FIELDS = EDITABLE_FIELDS;
