const chalk = require('chalk');
const { requireInit, readJson, MOLDS_FILE, MAINTENANCE_FILE, REPAIR_FILE } = require('../utils');

const STATUS_MAP = {
  in_stock: '在库',
  out_stock: '出库',
  maintenance: '保养中',
  repair: '维修中',
  scrapped: '已报废'
};

exports.describe = '查看模具详细信息（寿命、图纸、保养记录）';

exports.handler = function (code, opts) {
  requireInit();

  const molds = readJson(MOLDS_FILE) || [];
  const mold = molds.find(function (m) { return m.code === code; });

  if (!mold) {
    console.error(chalk.red('未找到模具: ' + code));
    process.exit(1);
  }

  const usage = mold.lifespan > 0 ? Math.round(mold.usedCount / mold.lifespan * 100) : 0;
  const remaining = Math.max(0, mold.lifespan - mold.usedCount);
  const statusStr = STATUS_MAP[mold.status] || mold.status;

  console.log(chalk.cyan.bold('═══ 模具详细信息 ═══'));
  console.log('');
  console.log(chalk.white('  编号:     ') + chalk.bold(mold.code));
  console.log(chalk.white('  名称:     ') + (mold.name || '-'));
  console.log(chalk.white('  客户:     ') + (mold.customer || '-'));
  console.log(chalk.white('  分类:     ') + (mold.category || '-'));
  console.log(chalk.white('  状态:     ') + (mold.status === 'scrapped' ? chalk.red(statusStr) : chalk.green(statusStr)));
  console.log(chalk.white('  库位:     ') + (mold.location || '-'));
  console.log('');

  console.log(chalk.cyan.bold('── 寿命信息 ──'));
  console.log(chalk.white('  设计寿命: ') + mold.lifespan + ' 模次');
  console.log(chalk.white('  已用模次: ') + mold.usedCount + ' 模次');
  console.log(chalk.white('  剩余模次: ') + (remaining <= 0 ? chalk.red(remaining) : remaining));
  console.log(chalk.white('  寿命使用: ') + (usage >= 90 ? chalk.red(usage + '%') : usage >= 70 ? chalk.yellow(usage + '%') : usage + '%'));
  console.log('');

  console.log(chalk.cyan.bold('── 采购信息 ──'));
  console.log(chalk.white('  图纸编号: ') + (mold.drawingNo || '-'));
  console.log(chalk.white('  购入日期: ') + (mold.purchaseDate || '-'));
  console.log(chalk.white('  采购价格: ') + (mold.price > 0 ? '¥' + mold.price.toFixed(2) : '-'));
  console.log('');

  if (mold.status === 'out_stock') {
    console.log(chalk.cyan.bold('── 出库信息 ──'));
    console.log(chalk.white('  出库日期: ') + (mold.lastOutDate || '-'));
    console.log(chalk.white('  领用人:   ') + (mold.lastOutPerson || '-'));
    console.log('');
  }

  if (mold.status === 'scrapped') {
    console.log(chalk.cyan.bold('── 报废信息 ──'));
    console.log(chalk.white('  报废日期: ') + (mold.scrapDate || '-'));
    console.log(chalk.white('  报废原因: ') + (mold.scrapReason || '-'));
    console.log('');
  }

  const maintenances = (readJson(MAINTENANCE_FILE) || []).filter(function (r) { return r.moldCode === mold.code; });
  if (maintenances.length > 0) {
    console.log(chalk.cyan.bold('── 保养记录 (最近5条) ──'));
    maintenances.slice(-5).reverse().forEach(function (r) {
      const statusTag = r.status === 'done' ? chalk.green('[已完成]') : r.status === 'overdue' ? chalk.red('[逾期]') : chalk.yellow('[待保养]');
      console.log('  ' + r.planDate + ' ' + statusTag + ' ' + (r.type || '') + ' ' + (r.remark || ''));
    });
    console.log('');
  }

  const repairs = (readJson(REPAIR_FILE) || []).filter(function (r) { return r.moldCode === mold.code; });
  if (repairs.length > 0) {
    console.log(chalk.cyan.bold('── 维修记录 (最近5条) ──'));
    repairs.slice(-5).reverse().forEach(function (r) {
      console.log('  ' + r.date + ' ' + chalk.red('[故障]') + ' ' + r.fault + ' 停机:' + r.downtime + 'h 费用:¥' + r.cost);
    });
    console.log('');
  }

  console.log(chalk.gray('  创建时间: ' + mold.createdAt));
  console.log(chalk.gray('  更新时间: ' + mold.updatedAt));
};
