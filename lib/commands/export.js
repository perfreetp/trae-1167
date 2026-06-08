const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const { stringify } = require('csv-stringify/sync');
const { requireInit, readJson, addLog, MOLDS_FILE, MAINTENANCE_FILE, REPAIR_FILE, LOGS_FILE, TRANSACTIONS_FILE } = require('../utils');
const reportModule = require('./report');
const flowModule = require('./report-flow');

exports.describe = '导出数据为CSV表格';

function flattenObject(obj, prefix) {
  var rows = [];
  Object.keys(obj).forEach(function (key) {
    var val = obj[key];
    var label = prefix ? prefix + '.' + key : key;
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      rows = rows.concat(flattenObject(val, label));
    } else {
      rows.push({ metric: label, value: val === null || val === undefined ? '' : String(val) });
    }
  });
  return rows;
}

function buildReportCSV(type, exportOpts) {
  var data;
  var rows;

  switch (type) {
    case 'report-utilization':
      data = reportModule.reportUtilization.buildData();
      if (!data) return null;
      rows = flattenObject(data, '');
      return rows;

    case 'report-repair-rate':
      data = reportModule.reportRepairRate.buildData();
      var flatData = flattenObject(data, '');
      data.frequentMolds.forEach(function (entry) {
        flatData.push({ metric: 'frequentMolds.' + entry[0], value: String(entry[1]) });
      });
      return flatData;

    case 'report-idle':
      data = reportModule.reportIdle.buildData();
      if (!data || data.length === 0) return null;
      return data;

    case 'report-summary':
      data = reportModule.reportSummary.buildData();
      rows = [];
      rows.push({ metric: 'total', value: String(data.total) });
      rows.push({ metric: 'active', value: String(data.active) });
      rows.push({ metric: 'scrapped', value: String(data.scrapped) });
      rows.push({ metric: 'highUsage', value: String(data.highUsage) });
      rows.push({ metric: 'overdueMaint', value: String(data.overdueMaint) });
      rows.push({ metric: 'totalRepairCount', value: String(data.totalRepairCount) });
      rows.push({ metric: 'totalRepairCost', value: data.totalRepairCost.toFixed(2) });
      rows.push({ metric: 'monthlyOutCount', value: String(data.monthlyOutCount) });
      rows.push({ metric: 'monthlyRepairCost', value: data.monthlyRepairCost.toFixed(2) });
      rows.push({ metric: 'monthlyScrapped', value: String(data.monthlyScrapped) });
      Object.entries(data.byStatus).forEach(function (entry) {
        rows.push({ metric: 'byStatus.' + entry[0], value: String(entry[1]) });
      });
      Object.entries(data.byCustomer).forEach(function (entry) {
        rows.push({ metric: 'byCustomer.' + entry[0] + '.total', value: String(entry[1].total) });
        rows.push({ metric: 'byCustomer.' + entry[0] + '.inStock', value: String(entry[1].inStock) });
        rows.push({ metric: 'byCustomer.' + entry[0] + '.outStock', value: String(entry[1].outStock) });
        rows.push({ metric: 'byCustomer.' + entry[0] + '.maint', value: String(entry[1].maint) });
        rows.push({ metric: 'byCustomer.' + entry[0] + '.repair', value: String(entry[1].repair) });
      });
      return rows;

    case 'report-flow':
      var flowCode = (exportOpts && exportOpts.flowCode) || '';
      var flowOpts = { from: exportOpts && exportOpts.from, to: exportOpts && exportOpts.to, action: exportOpts && exportOpts.action, customer: exportOpts && exportOpts.customer, status: exportOpts && exportOpts.status };
      var flowEvents = flowModule.reportFlow.buildData(flowCode || null, flowOpts);
      if (!flowEvents || flowEvents.length === 0) return null;
      return flowEvents.map(function (e) {
        return { moldCode: e.moldCode, date: e.time, action: e.label, detail: e.detail };
      });

    case 'report-cost':
      var costModule = require('./report-cost');
      var costRows = costModule.reportCost.buildData();
      if (!costRows || costRows.length === 0) return null;
      return costRows;

    default:
      return null;
  }
}

exports.handler = function (opts) {
  requireInit();
  opts = opts || {};

  var data = [];
  var filename = '';
  var isReport = opts.type && opts.type.startsWith('report-');

  if (isReport) {
    var reportRows = buildReportCSV(opts.type, opts);
    if (!reportRows) {
      console.log(chalk.yellow('没有数据可导出'));
      return;
    }

    var headers = Object.keys(reportRows[0]);
    var csvRows = [headers].concat(reportRows.map(function (item) {
      return headers.map(function (h) {
        var val = item[h];
        if (val === null || val === undefined) return '';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
      });
    }));

    var csv = stringify(csvRows, {});
    filename = opts.output || (opts.type + '_export.csv');
    var outPath = path.resolve(filename);
    fs.writeFileSync(outPath, '\uFEFF' + csv, 'utf-8');

    addLog('export', '导出报表 ' + opts.type + ' 到 ' + outPath);
    console.log(chalk.green('✔ 已导出报表到 ' + outPath));
    return;
  }

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
    case 'transactions':
      data = readJson(TRANSACTIONS_FILE) || [];
      filename = opts.output || 'transactions_export.csv';
      break;
    default:
      console.error(chalk.red('不支持的导出类型: ' + opts.type));
      console.log(chalk.gray('原始数据: molds, maintenance, repairs, logs, transactions'));
      console.log(chalk.gray('报表数据: report-utilization, report-repair-rate, report-idle, report-summary, report-flow'));
      process.exit(1);
  }

  if (data.length === 0) {
    console.log(chalk.yellow('没有数据可导出'));
    return;
  }

  var headers = Object.keys(data[0]);
  var rows = data.map(function (item) {
    return headers.map(function (h) {
      var val = item[h];
      if (val === null || val === undefined) return '';
      if (typeof val === 'object') return JSON.stringify(val);
      return String(val);
    });
  });

  var csv = stringify([headers].concat(rows), {});

  var outPath = path.resolve(filename);
  fs.writeFileSync(outPath, '\uFEFF' + csv, 'utf-8');

  addLog('export', '导出 ' + opts.type + ' 数据到 ' + outPath + ', 共' + data.length + '条');

  console.log(chalk.green('✔ 已导出 ' + data.length + ' 条记录到 ' + outPath));
};
