const chalk = require('chalk');
const Table = require('cli-table3');
const dayjs = require('dayjs');
const { requireInit, readJson, MOLDS_FILE, LOGS_FILE, MAINTENANCE_FILE, REPAIR_FILE, TRANSACTIONS_FILE } = require('../utils');

exports.describe = '查看模具流转时间线/总流转报表';

var QUERY_ACTIONS = ['detail', 'search', 'warn', 'report:utilization', 'report:repair-rate', 'report:idle', 'report:summary', 'report:flow', 'export'];

var FLOW_ACTIONS = {
  'import': { label: '导入建档', color: chalk.cyan },
  'edit': { label: '编辑', color: chalk.blue },
  'repair': { label: '维修', color: chalk.red },
  'maintain:done': { label: '保养完成', color: chalk.green },
  'scrap': { label: '报废', color: chalk.red.bold },
  'move': { label: '移库', color: chalk.blue },
  'print': { label: '打印标签', color: chalk.gray },
  'tx:edit': { label: '流转更正', color: chalk.magenta },
  'tx:add': { label: '流转补录', color: chalk.magenta }
};

function getActionMeta(action) {
  if (FLOW_ACTIONS[action]) return FLOW_ACTIONS[action];
  return { label: action, color: chalk.white };
}

function buildFlowData(code, opts) {
  opts = opts || {};
  var from = opts.from || '';
  var to = opts.to || '';
  var actionFilter = opts.action || '';
  var customerFilter = opts.customer || '';
  var events = [];

  var molds = readJson(MOLDS_FILE) || [];
  var targetCodes = null;

  if (code) {
    targetCodes = new Set([code.toLowerCase()]);
  } else {
    if (customerFilter) {
      targetCodes = new Set(
        molds.filter(function (m) { return (m.customer || '').toLowerCase() === customerFilter.toLowerCase(); })
          .map(function (m) { return m.code.toLowerCase(); })
      );
    } else {
      targetCodes = new Set(molds.map(function (m) { return m.code.toLowerCase(); }));
    }
  }

  var logs = readJson(LOGS_FILE) || [];
  logs.forEach(function (l) {
    if (!l.moldCode) return;
    if (!targetCodes.has(l.moldCode.toLowerCase())) return;
    if (QUERY_ACTIONS.indexOf(l.action) !== -1) return;
    if (l.action === 'out' || l.action === 'in' || l.action === 'maintain:plan') return;

    var dateStr = l.time ? l.time.slice(0, 10) : '';
    var timeStr = l.time ? l.time.slice(0, 19).replace('T', ' ') : '';
    if (from && dateStr < from) return;
    if (to && dateStr > to) return;
    if (actionFilter && l.action !== actionFilter) return;

    var meta = getActionMeta(l.action);
    events.push({
      moldCode: l.moldCode,
      date: dateStr,
      time: timeStr,
      sortKey: l.time || '',
      action: l.action || '',
      label: meta.label,
      detail: l.detail || '',
      colorFn: meta.color
    });
  });

  var transactions = readJson(TRANSACTIONS_FILE) || [];
  transactions.forEach(function (t) {
    if (!t.moldCode) return;
    if (!targetCodes.has(t.moldCode.toLowerCase())) return;

    var moldInfo = molds.find(function (m) { return m.code.toLowerCase() === t.moldCode.toLowerCase(); });

    if (t.outDate) {
      var dateStr = t.outDate;
      if ((!from || dateStr >= from) && (!to || dateStr <= to)) {
        if (!actionFilter || actionFilter === 'out') {
          events.push({
            moldCode: t.moldCode,
            date: dateStr,
            time: dateStr,
            sortKey: dateStr + 'T00:00:00.000-OUT-' + t.id,
            action: 'out',
            label: '出库',
            detail: '领用人: ' + t.person + (t.expectedReturnDate ? ', 预计归还: ' + t.expectedReturnDate : '') + (t.usageCount > 0 ? ', 模次: ' + t.usageCount : '') + (t.outRemark ? ', 备注: ' + t.outRemark : ''),
            colorFn: chalk.yellow,
            customer: moldInfo ? moldInfo.customer : ''
          });
        }
      }
    }
    if (t.status === 'returned' && t.returnDate) {
      var dateStr = t.returnDate;
      if ((!from || dateStr >= from) && (!to || dateStr <= to)) {
        if (!actionFilter || actionFilter === 'in') {
          events.push({
            moldCode: t.moldCode,
            date: dateStr,
            time: dateStr,
            sortKey: dateStr + 'T23:59:59.999-IN-' + t.id,
            action: 'in',
            label: '入库(归还)',
            detail: '归还人: ' + t.person + (t.returnRemark ? ', 备注: ' + t.returnRemark : ''),
            colorFn: chalk.green,
            customer: moldInfo ? moldInfo.customer : ''
          });
        }
      }
    }
  });

  var repairs = readJson(REPAIR_FILE) || [];
  repairs.forEach(function (r) {
    if (!r.moldCode) return;
    if (!targetCodes.has(r.moldCode.toLowerCase())) return;
    var dateStr = r.date || '';
    if (!dateStr) return;
    if (from && dateStr < from) return;
    if (to && dateStr > to) return;
    if (actionFilter && actionFilter !== 'repair') return;
    events.push({
      moldCode: r.moldCode,
      date: dateStr,
      time: dateStr,
      sortKey: dateStr + 'T12:00:00.000-REPAIR-' + (r.id || ''),
      action: 'repair',
      label: '维修',
      detail: '故障: ' + r.fault + ', 停机: ' + r.downtime + 'h, 费用: ¥' + (r.cost || 0),
      colorFn: chalk.red
    });
  });

  var plans = readJson(MAINTENANCE_FILE) || [];
  plans.forEach(function (p) {
    if (!p.moldCode) return;
    if (!targetCodes.has(p.moldCode.toLowerCase())) return;
    if (p.status === 'done' && p.completedDate) {
      var dateStr = p.completedDate;
      if ((!from || dateStr >= from) && (!to || dateStr <= to)) {
        if (!actionFilter || actionFilter === 'maintain:done') {
          events.push({
            moldCode: p.moldCode,
            date: dateStr,
            time: dateStr,
            sortKey: dateStr + 'T12:00:00.000-MAINT-' + p.id,
            action: 'maintain:done',
            label: '保养完成',
            detail: '计划日期: ' + p.planDate + (p.remark ? ', 备注: ' + p.remark : ''),
            colorFn: chalk.green
          });
        }
      }
    }
  });

  events.sort(function (a, b) {
    if (a.sortKey < b.sortKey) return -1;
    if (a.sortKey > b.sortKey) return 1;
    return 0;
  });

  return events;
}

function reportFlow(code, opts) {
  requireInit();
  opts = opts || {};

  if (code) {
    var molds = readJson(MOLDS_FILE) || [];
    var mold = molds.find(function (m) { return m.code.toLowerCase() === code.toLowerCase(); });
    if (!mold) {
      console.error(chalk.red('未找到模具: ' + code));
      process.exit(1);
    }
  }

  var events = buildFlowData(code, opts);

  if (events.length === 0) {
    console.log(chalk.yellow('暂无流转记录'));
    return;
  }

  if (code) {
    var moldInfo = (readJson(MOLDS_FILE) || []).find(function (m) { return m.code.toLowerCase() === code.toLowerCase(); });
    console.log(chalk.cyan.bold('═══ 模具履历: ' + code + ' ' + (moldInfo ? moldInfo.name || '' : '') + ' ═══'));
    console.log('');

    var table = new Table({
      head: [chalk.cyan('日期'), chalk.cyan('操作'), chalk.cyan('详情')],
      colWidths: [20, 12, 60],
      style: { 'padding-left': 1, 'padding-right': 1 }
    });

    events.forEach(function (e) {
      table.push([
        e.time,
        e.colorFn(e.label),
        e.detail.length > 50 ? e.detail.substring(0, 50) + '...' : e.detail
      ]);
    });

    console.log(table.toString());
    console.log(chalk.gray('共 ' + events.length + ' 条流转记录'));
  } else {
    console.log(chalk.cyan.bold('═══ 流转总报表 ═══'));
    if (opts.from || opts.to) {
      console.log(chalk.gray('  时间范围: ' + (opts.from || '最早') + ' ~ ' + (opts.to || '至今')));
    }
    console.log('');

    var table = new Table({
      head: [chalk.cyan('日期'), chalk.cyan('模具编号'), chalk.cyan('操作'), chalk.cyan('详情')],
      colWidths: [20, 14, 12, 46],
      style: { 'padding-left': 1, 'padding-right': 1 }
    });

    events.forEach(function (e) {
      table.push([
        e.time,
        e.moldCode,
        e.colorFn(e.label),
        e.detail.length > 38 ? e.detail.substring(0, 38) + '...' : e.detail
      ]);
    });

    console.log(table.toString());
    console.log(chalk.gray('共 ' + events.length + ' 条流转记录'));
  }
}

reportFlow.buildData = buildFlowData;

exports.reportFlow = reportFlow;
