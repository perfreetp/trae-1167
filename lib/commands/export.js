const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const { stringify } = require('csv-stringify/sync');
const { requireInit, readJson, addLog, MOLDS_FILE, MAINTENANCE_FILE, REPAIR_FILE, LOGS_FILE } = require('../utils');

exports.describe = '导出数据为CSV表格';

exports.handler = function (opts) {
  requireInit();
  opts = opts || {};

  let data = [];
  let filename = '';

  switch (opts.type) {
    case 'molds':
      data = readJson(MOLDS_FILE) || [];
      filename = opts.output || 'molds_export.csv';
      break;
    case 'maintenance':
      data = readJson(MAINTENANCE_FILE) || [];
      filename = opts.output || 'maintenance_export.csv';
      break;
    case 'repairs':
      data = readJson(REPAIR_FILE) || [];
      filename = opts.output || 'repairs_export.csv';
      break;
    case 'logs':
      data = readJson(LOGS_FILE) || [];
      filename = opts.output || 'logs_export.csv';
      break;
    default:
      console.error(chalk.red('不支持的导出类型: ' + opts.type));
      process.exit(1);
  }

  if (data.length === 0) {
    console.log(chalk.yellow('没有数据可导出'));
    return;
  }

  const headers = Object.keys(data[0]);
  const rows = data.map(function (item) {
    return headers.map(function (h) {
      const val = item[h];
      if (val === null || val === undefined) return '';
      if (typeof val === 'object') return JSON.stringify(val);
      return String(val);
    });
  });

  const csv = stringify([headers].concat(rows), {});

  const outPath = path.resolve(filename);
  fs.writeFileSync(outPath, '\uFEFF' + csv, 'utf-8');

  addLog('export', `导出 ${opts.type} 数据到 ${outPath}, 共${data.length}条`);

  console.log(chalk.green(`✔ 已导出 ${data.length} 条记录到 ${outPath}`));
};
