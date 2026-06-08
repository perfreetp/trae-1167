const chalk = require('chalk');
const { requireInit, readJson, addLog, MOLDS_FILE } = require('../utils');

exports.describe = '输出模具标签内容';

exports.handler = function (code, opts) {
  requireInit();

  const molds = readJson(MOLDS_FILE) || [];
  const mold = molds.find(function (m) { return m.code === code; });

  if (!mold) {
    console.error(chalk.red('未找到模具: ' + code));
    process.exit(1);
  }

  const STATUS_MAP = {
    in_stock: '在库',
    out_stock: '出库',
    maintenance: '保养中',
    repair: '维修中',
    scrapped: '已报废'
  };

  const usage = mold.lifespan > 0 ? Math.round(mold.usedCount / mold.lifespan * 100) : 0;

  console.log('┌──────────────────────────────────┐');
  console.log('│        模 具 标 签               │');
  console.log('├──────────────────────────────────┤');
  console.log('│ 编号: ' + padRight(mold.code, 26) + '│');
  console.log('│ 名称: ' + padRight(mold.name || '-', 26) + '│');
  console.log('│ 客户: ' + padRight(mold.customer || '-', 26) + '│');
  console.log('│ 库位: ' + padRight(mold.location || '-', 26) + '│');
  console.log('│ 状态: ' + padRight(STATUS_MAP[mold.status] || mold.status, 26) + '│');
  console.log('│ 寿命: ' + padRight(mold.usedCount + '/' + mold.lifespan + ' (' + usage + '%)', 26) + '│');
  console.log('│ 图号: ' + padRight(mold.drawingNo || '-', 26) + '│');
  if (mold.status === 'out_stock') {
    console.log('│ 领用: ' + padRight(mold.lastOutPerson || '-', 26) + '│');
    console.log('│ 日期: ' + padRight(mold.lastOutDate || '-', 26) + '│');
  }
  console.log('├──────────────────────────────────┤');
  console.log('│ 打印日期: ' + padRight(new Date().toISOString().slice(0, 10), 22) + '│');
  console.log('└──────────────────────────────────┘');

  addLog('print', '打印标签: ' + code, code);
};

function padRight(str, len) {
  const s = String(str);
  const actualLen = getDisplayWidth(s);
  if (actualLen >= len) return s;
  return s + ' '.repeat(len - actualLen);
}

function getDisplayWidth(str) {
  let width = 0;
  for (let i = 0; i < str.length; i++) {
    if (str.charCodeAt(i) > 127) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}
