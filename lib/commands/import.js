const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { requireInit, readJson, writeJson, addLog, generateId, MOLDS_FILE, CONFIG_FILE } = require('../utils');

exports.describe = '批量导入模具清单（支持CSV/JSON）';

var UPDATABLE_FIELDS = ['name', 'customer', 'location', 'category', 'lifespan', 'usedCount', 'drawingNo', 'purchaseDate', 'price'];
var FIELD_ALIASES = {
  name: ['名称', '模具名称'],
  customer: ['客户', '客户名称'],
  location: ['库位', '存放位置'],
  category: ['分类', '模具类型'],
  lifespan: ['寿命', '设计寿命'],
  usedCount: ['已用模次', '已用次数'],
  drawingNo: ['图号', '图纸编号'],
  purchaseDate: ['购入日期', '采购日期'],
  price: ['价格', '采购价格']
};

function resolveField(item, fieldName) {
  if (item[fieldName] !== undefined) return item[fieldName];
  var aliases = FIELD_ALIASES[fieldName] || [];
  for (var i = 0; i < aliases.length; i++) {
    if (item[aliases[i]] !== undefined) return item[aliases[i]];
  }
  return undefined;
}

exports.handler = function (file, opts) {
  requireInit();
  opts = opts || {};

  var filePath = path.resolve(file);
  if (!fs.existsSync(filePath)) {
    console.error(chalk.red('文件不存在: ' + filePath));
    process.exit(1);
  }

  var molds = readJson(MOLDS_FILE) || [];
  var config = readJson(CONFIG_FILE) || {};
  var imported = [];

  try {
    if (filePath.endsWith('.json')) {
      var raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      imported = Array.isArray(raw) ? raw : [raw];
    } else if (filePath.endsWith('.csv')) {
      var content = fs.readFileSync(filePath, 'utf-8');
      var records = parse(content, { columns: true, skip_empty_lines: true, trim: true });
      imported = records;
    } else {
      console.error(chalk.red('仅支持 .csv 和 .json 文件'));
      process.exit(1);
    }
  } catch (e) {
    console.error(chalk.red('解析文件失败: ' + e.message));
    process.exit(1);
  }

  var mode = opts.mode || 'skip';
  var added = 0;
  var updated = 0;
  var skipped = 0;
  var conflicts = [];
  var updateDetails = [];

  imported.forEach(function (item) {
    var code = item.code || item.编号 || item['模具编号'];
    if (!code) { skipped++; return; }

    var exists = molds.find(function (m) { return m.code === code; });

    if (!exists) {
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
      return;
    }

    if (mode === 'update') {
      var changed = [];
      UPDATABLE_FIELDS.forEach(function (field) {
        var newVal = resolveField(item, field);
        if (newVal === undefined || newVal === null || newVal === '') return;
        var parsed = newVal;
        if (field === 'lifespan' || field === 'usedCount') {
          parsed = parseInt(newVal, 10);
          if (isNaN(parsed)) return;
        }
        if (field === 'price') {
          parsed = parseFloat(newVal);
          if (isNaN(parsed)) return;
        }
        var oldVal = exists[field];
        if (String(oldVal) !== String(parsed)) {
          changed.push({ field: field, oldVal: oldVal, newVal: parsed });
          exists[field] = parsed;
        }
      });
      if (changed.length > 0) {
        exists.updatedAt = new Date().toISOString();
        updated++;
        updateDetails.push({ code: code, changes: changed });
      } else {
        skipped++;
      }
    } else if (mode === 'conflict') {
      var conflictFields = [];
      UPDATABLE_FIELDS.forEach(function (field) {
        var newVal = resolveField(item, field);
        if (newVal === undefined || newVal === null || newVal === '') return;
        var parsed = newVal;
        if (field === 'lifespan' || field === 'usedCount') {
          parsed = parseInt(newVal, 10);
          if (isNaN(parsed)) return;
        }
        if (field === 'price') {
          parsed = parseFloat(newVal);
          if (isNaN(parsed)) return;
        }
        if (String(exists[field]) !== String(parsed)) {
          conflictFields.push({ field: field, oldVal: exists[field], newVal: parsed });
        }
      });
      conflicts.push({ code: code, fields: conflictFields });
      skipped++;
    } else {
      skipped++;
    }
  });

  writeJson(MOLDS_FILE, molds);

  imported.forEach(function (item) {
    var code = item.code || item.编号 || item['模具编号'];
    if (code) {
      addLog('import', '导入建档: ' + file + ', 编号: ' + code, code);
    }
  });

  updateDetails.forEach(function (u) {
    var desc = u.changes.map(function (c) { return c.field + ': ' + c.oldVal + '→' + c.newVal; }).join(', ');
    addLog('import', '导入更新: ' + u.code + ' - ' + desc, u.code);
  });

  console.log(chalk.cyan.bold('═══ 导入结果 ═══'));
  console.log(chalk.green('  新增: ' + added + ' 条'));
  if (mode === 'update') {
    console.log(chalk.blue('  更新: ' + updated + ' 条'));
  }
  console.log(chalk.gray('  跳过: ' + skipped + ' 条'));
  if (mode === 'conflict' && conflicts.length > 0) {
    console.log(chalk.yellow('  冲突: ' + conflicts.length + ' 条'));
    console.log('');
    console.log(chalk.yellow.bold('── 冲突明细 ──'));
    conflicts.forEach(function (c) {
      console.log(chalk.white('  ' + c.code + ':'));
      c.fields.forEach(function (f) {
        console.log(chalk.gray('    ' + f.field + ': 台账=' + f.oldVal + ' 文件=' + f.newVal));
      });
    });
  }

  if (mode !== 'update' && mode !== 'conflict' && skipped > 0) {
    console.log('');
    console.log(chalk.gray('  提示: 重复编号默认跳过，可使用 --mode update 更新已有，或 --mode conflict 查看冲突'));
  }
};
