const chalk = require('chalk');
const Table = require('cli-table3');
const dayjs = require('dayjs');
const { requireInit, readJson, writeJson, addLog, today, MOLDS_FILE, MAINTENANCE_FILE, CONFIG_FILE } = require('../utils');

exports.describe = '模具保养管理';

function handlePlan(code, opts) {
  requireInit();

  const argv = opts || code || {};
  const moldCode = opts ? code : undefined;
  const days = (opts && opts.days) || 30;

  const molds = readJson(MOLDS_FILE) || [];
  const config = readJson(CONFIG_FILE) || {};
  const plans = readJson(MAINTENANCE_FILE) || [];
  const cycle = config.maintCycle || 30;

  let targets = molds.filter(function (m) { return m.status !== 'scrapped'; });
  if (moldCode) {
    targets = targets.filter(function (m) { return m.code === moldCode; });
  }

  let created = 0;
  targets.forEach(function (mold) {
    const lastDate = mold.lastMaintenance || mold.purchaseDate || mold.createdAt.slice(0, 10);
    const nextDate = dayjs(lastDate).add(cycle, 'day').format('YYYY-MM-DD');
    const endDate = dayjs().add(days, 'day').format('YYYY-MM-DD');

    if (nextDate <= endDate) {
      const exists = plans.find(function (p) {
        return p.moldCode === mold.code && p.planDate === nextDate && p.status === 'pending';
      });
      if (!exists) {
        plans.push({
          id: 'MT' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase(),
          moldCode: mold.code,
          moldName: mold.name,
          planDate: nextDate,
          type: '定期保养',
          status: nextDate < today() ? 'overdue' : 'pending',
          remark: '',
          completedDate: '',
          createdAt: new Date().toISOString()
        });
        created++;
      }
    }
  });

  writeJson(MAINTENANCE_FILE, plans);
  addLog('maintain:plan', '生成保养计划 ' + created + ' 条');

  console.log(chalk.green('✔ 已生成 ' + created + ' 条保养计划'));
}

function handleDone(id, opts) {
  requireInit();

  const planId = opts ? id : id;
  const remark = (opts && opts.remark) || '';

  const plans = readJson(MAINTENANCE_FILE) || [];
  const idx = plans.findIndex(function (p) { return p.id === planId; });
  if (idx === -1) {
    console.error(chalk.red('未找到保养计划: ' + planId));
    process.exit(1);
  }

  if (plans[idx].status === 'done') {
    console.error(chalk.yellow('该保养计划已完成'));
    process.exit(1);
  }

  plans[idx].status = 'done';
  plans[idx].completedDate = today();
  plans[idx].remark = remark || plans[idx].remark;

  const molds = readJson(MOLDS_FILE) || [];
  const moldIdx = molds.findIndex(function (m) { return m.code === plans[idx].moldCode; });
  if (moldIdx !== -1) {
    molds[moldIdx].lastMaintenance = today();
    molds[moldIdx].updatedAt = new Date().toISOString();
    if (molds[moldIdx].status === 'maintenance') {
      molds[moldIdx].status = 'in_stock';
    }
    writeJson(MOLDS_FILE, molds);
  }

  writeJson(MAINTENANCE_FILE, plans);
  addLog('maintain:done', '完成保养: 模具' + plans[idx].moldCode + ', 计划ID:' + planId);

  console.log(chalk.green('✔ 保养已完成: ' + plans[idx].moldCode + ' (' + plans[idx].planDate + ')'));
}

function handleList(opts) {
  requireInit();

  const filters = opts || {};
  let plans = readJson(MAINTENANCE_FILE) || [];

  if (filters.status) {
    plans = plans.filter(function (p) { return p.status === filters.status; });
  }
  if (filters.code) {
    plans = plans.filter(function (p) { return p.moldCode === filters.code; });
  }

  if (plans.length === 0) {
    console.log(chalk.yellow('未找到保养计划'));
    return;
  }

  const table = new Table({
    head: [chalk.cyan('ID'), chalk.cyan('模具编号'), chalk.cyan('计划日期'), chalk.cyan('类型'), chalk.cyan('状态'), chalk.cyan('备注')],
    colWidths: [14, 14, 12, 10, 10, 20],
    style: { 'padding-left': 1, 'padding-right': 1 }
  });

  plans.forEach(function (p) {
    const statusStr = p.status === 'done' ? chalk.green('已完成') : p.status === 'overdue' ? chalk.red('逾期') : chalk.yellow('待保养');
    table.push([p.id, p.moldCode, p.planDate, p.type || '-', statusStr, p.remark || '-']);
  });

  console.log(table.toString());
  console.log(chalk.gray('共 ' + plans.length + ' 条记录'));
}

exports.handler = function (args) {
  const subcmd = args[0];
  if (subcmd === 'plan') {
    handlePlan(args[1], args[2]);
  } else if (subcmd === 'done') {
    handleDone(args[1], args[2]);
  } else if (subcmd === 'list') {
    handleList(args[1]);
  }
};

exports.handlePlan = handlePlan;
exports.handleDone = handleDone;
exports.handleList = handleList;
