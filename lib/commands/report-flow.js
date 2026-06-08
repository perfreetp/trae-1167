const chalk = require('chalk');
const Table = require('cli-table3');
const dayjs = require('dayjs');
const { requireInit, readJson, addLog, MOLDS_FILE, LOGS_FILE, MAINTENANCE_FILE, REPAIR_FILE, TRANSACTIONS_FILE } = require('../utils');

exports.describe = '按模具编号查看完整流转时间线';

var ACTION_LABELS = {
  'init': '初始化',
  'import': '导入',
  'edit': '编辑',
  'out': '出库',
  'in': '入库',
  'repair': '维修',
  'maintain:plan': '保养计划',
  'maintain:done': '保养完成',
  'scrap': '报废',
  'move': '移库',
  'detail': '查看详情',
  'search': '搜索',
  'warn': '预警',
  'report:utilization': '利用率报表',
  'report:repair-rate': '维修率报表',
  'report:idle': '闲置清单',
  'report:summary': '综合概览',
  'export': '导出',
  'print': '打印标签',
  'report:flow': '流转时间线'
};

var ACTION_COLORS = {
  'init': chalk.gray,
  'import': chalk.cyan,
  'edit': chalk.blue,
  'out': chalk.yellow,
  'in': chalk.green,
  'repair': chalk.red,
  'maintain:plan': chalk.magenta,
  'maintain:done': chalk.green,
  'scrap': chalk.red.bold,
  'move': chalk.blue,
  'detail': chalk.gray,
  'search': chalk.gray,
  'warn': chalk.yellow,
  'report:utilization': chalk.cyan,
  'report:repair-rate': chalk.cyan,
  'report:idle': chalk.cyan,
  'report:summary': chalk.cyan,
  'export': chalk.gray,
  'print': chalk.gray,
  'report:flow': chalk.cyan
};

function buildFlowData(code, opts) {
  opts = opts || {};
  var from = opts.from || '';
  var to = opts.to || '';
  var events = [];

  var logs = readJson(LOGS_FILE) || [];
  var moldLogs = logs.filter(function (l) {
    if (l.moldCode && l.moldCode.toLowerCase() === code.toLowerCase()) return true;
    if (l.detail && l.detail.toLowerCase().includes(code.toLowerCase())) return true;
    return false;
  });

  moldLogs.forEach(function (l) {
    if (l.action === 'out' || l.action === 'in') return;
    var dateStr = l.time ? l.time.slice(0, 10) : '';
    var timeStr = l.time ? l.time.slice(0, 19).replace('T', ' ') : '';
    if (from && dateStr < from) return;
    if (to && dateStr > to) return;
    events.push({
      date: dateStr,
      time: timeStr,
      sortKey: l.time || '',
      action: l.action || '',
      label: ACTION_LABELS[l.action] || l.action || '',
      detail: l.detail || '',
      colorFn: ACTION_COLORS[l.action] || chalk.white
    });
  });

  var transactions = (readJson(TRANSACTIONS_FILE) || []).filter(function (t) {
    return t.moldCode && t.moldCode.toLowerCase() === code.toLowerCase();
  });
  transactions.forEach(function (t) {
    if (t.outDate) {
      var dateStr = t.outDate;
      if ((!from || dateStr >= from) && (!to || dateStr <= to)) {
        events.push({
          date: dateStr,
          time: dateStr,
          sortKey: dateStr + 'T00:00:00.000-OUT-' + t.id,
          action: 'out',
          label: '出库',
          detail: '领用人: ' + t.person + (t.expectedReturnDate ? ', 预计归还: ' + t.expectedReturnDate : '') + (t.usageCount > 0 ? ', 模次: ' + t.usageCount : '') + (t.outRemark ? ', 备注: ' + t.outRemark : ''),
          colorFn: chalk.yellow
        });
      }
    }
    if (t.status === 'returned' && t.returnDate) {
      var dateStr = t.returnDate;
      if ((!from || dateStr >= from) && (!to || dateStr <= to)) {
        events.push({
          date: dateStr,
          time: dateStr,
          sortKey: dateStr + 'T23:59:59.999-IN-' + t.id,
          action: 'in',
          label: '入库(归还)',
          detail: '归还人: ' + t.person + (t.returnRemark ? ', 备注: ' + t.returnRemark : ''),
          colorFn: chalk.green
        });
      }
    }
  });

  var repairs = (readJson(REPAIR_FILE) || []).filter(function (r) {
    return r.moldCode && r.moldCode.toLowerCase() === code.toLowerCase();
  });
  repairs.forEach(function (r) {
    var dateStr = r.date || '';
    if (!dateStr) return;
    if (from && dateStr < from) return;
    if (to && dateStr > to) return;
    events.push({
      date: dateStr,
      time: dateStr,
      sortKey: dateStr + 'T12:00:00.000-REPAIR-' + (r.id || ''),
      action: 'repair',
      label: '维修',
      detail: '故障: ' + r.fault + ', 停机: ' + r.downtime + 'h, 费用: ¥' + (r.cost || 0),
      colorFn: chalk.red
    });
  });

  var plans = (readJson(MAINTENANCE_FILE) || []).filter(function (p) {
    return p.moldCode && p.moldCode.toLowerCase() === code.toLowerCase();
  });
  plans.forEach(function (p) {
    if (p.status === 'done' && p.completedDate) {
      var dateStr = p.completedDate;
      if ((!from || dateStr >= from) && (!to || dateStr <= to)) {
        events.push({
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

  if (!code) {
    console.error(chalk.red('请指定模具编号'));
    process.exit(1);
  }

  var molds = readJson(MOLDS_FILE) || [];
  var mold = molds.find(function (m) { return m.code.toLowerCase() === code.toLowerCase(); });
  if (!mold) {
    console.error(chalk.red('未找到模具: ' + code));
    process.exit(1);
  }

  var events = buildFlowData(code, opts);

  if (events.length === 0) {
    console.log(chalk.yellow('暂无流转记录'));
    addLog('report:flow', '查看流转时间线: ' + code + ' (无记录)', code);
    return;
  }

  console.log(chalk.cyan.bold('═══ 模具流转时间线: ' + code + ' ' + (mold.name || '') + ' ═══'));
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

  addLog('report:flow', '查看流转时间线: ' + code + ', ' + events.length + '条', code);
}

reportFlow.buildData = buildFlowData;

exports.reportFlow = reportFlow;
