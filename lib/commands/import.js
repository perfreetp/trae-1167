const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { requireInit, readJson, writeJson, addLog, generateId, MOLDS_FILE, CONFIG_FILE } = require('../utils');

exports.describe = '批量导入模具清单（支持CSV/JSON）';

exports.handler = function (file, opts) {
  requireInit();

  const filePath = path.resolve(file);
  if (!fs.existsSync(filePath)) {
    console.error(chalk.red('文件不存在: ' + filePath));
    process.exit(1);
  }

  const molds = readJson(MOLDS_FILE) || [];
  const config = readJson(CONFIG_FILE) || {};
  let imported = [];

  try {
    if (filePath.endsWith('.json')) {
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      imported = Array.isArray(raw) ? raw : [raw];
    } else if (filePath.endsWith('.csv')) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const records = parse(content, { columns: true, skip_empty_lines: true, trim: true });
      imported = records;
    } else {
      console.error(chalk.red('仅支持 .csv 和 .json 文件'));
      process.exit(1);
    }
  } catch (e) {
    console.error(chalk.red('解析文件失败: ' + e.message));
    process.exit(1);
  }

  let added = 0;
  let skipped = 0;

  imported.forEach(function (item) {
    const code = item.code || item.编号 || item['模具编号'];
    if (!code) { skipped++; return; }

    const exists = molds.find(function (m) { return m.code === code; });
    if (exists) { skipped++; return; }

    molds.push({
      id: generateId(),
      code: code,
      name: item.name || item.名称 || item['模具名称'] || '',
      customer: item.customer || item.客户 || item['客户名称'] || '',
      location: item.location || item.库位 || item['存放位置'] || '',
      status: item.status || item.状态 || 'in_stock',
      category: item.category || item.分类 || item['模具类型'] || '',
      lifespan: parseInt(item.lifespan || item.寿命 || item['设计寿命'] || config.defaultLifespan || 100000, 10),
      usedCount: parseInt(item.usedCount || item.已用模次 || item['已用次数'] || 0, 10),
      drawingNo: item.drawingNo || item.图号 || item['图纸编号'] || '',
      purchaseDate: item.purchaseDate || item.购入日期 || item['采购日期'] || '',
      price: parseFloat(item.price || item.价格 || item['采购价格'] || 0),
      lastMaintenance: item.lastMaintenance || item['上次保养'] || '',
      lastOutDate: '',
      lastOutPerson: '',
      scrapReason: '',
      scrapDate: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    added++;
  });

  writeJson(MOLDS_FILE, molds);
  addLog('import', '导入文件 ' + file + ': 成功' + added + '条, 跳过' + skipped + '条');

  console.log(chalk.green('✔ 导入完成: 成功 ' + added + ' 条, 跳过 ' + skipped + ' 条'));
};
