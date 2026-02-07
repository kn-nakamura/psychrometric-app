import ExcelJS from 'exceljs';
import { StatePoint } from '@/types/psychrometric';
import { Process } from '@/types/process';
import { DesignConditions } from '@/types/designConditions';
import { CoilCapacityCalculator } from '@/lib/equipment/coilCapacity';
import { inferModeFromSigned } from '@/lib/sign';

/**
 * プロセス種別の日本語ラベル
 */
const processTypeLabels: Record<Process['type'], string> = {
  heating: '加熱',
  cooling: '冷却',
  humidifying: '加湿',
  dehumidifying: '除湿',
  mixing: '混合',
  heatExchange: '全熱交換',
  fanHeating: 'ファン発熱',
  airSupply: '空調吹き出し',
};

const seasonLabel = (season: 'summer' | 'winter' | 'both') =>
  season === 'summer' ? '夏' : season === 'winter' ? '冬' : '通年';

/**
 * 共通ヘッダースタイル
 */
const headerFill: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF2563EB' },
};

const headerFont: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: 'FFFFFFFF' },
  size: 10,
};

const subHeaderFill: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFDBEAFE' },
};

const subHeaderFont: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: 'FF1E3A5F' },
  size: 10,
};

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
};

/**
 * 状態点シートを作成
 */
function buildStatePointsSheet(
  workbook: ExcelJS.Workbook,
  statePoints: StatePoint[],
  designConditions: DesignConditions,
) {
  const ws = workbook.addWorksheet('状態点一覧');

  // 列幅の設定
  ws.columns = [
    { key: 'label', width: 8 },
    { key: 'name', width: 18 },
    { key: 'season', width: 8 },
    { key: 'dryBulbTemp', width: 14 },
    { key: 'wetBulbTemp', width: 14 },
    { key: 'relativeHumidity', width: 14 },
    { key: 'humidity', width: 18 },
    { key: 'enthalpy', width: 18 },
    { key: 'dewPoint', width: 14 },
    { key: 'specificVolume', width: 16 },
    { key: 'airflow', width: 14 },
  ];

  // タイトル行
  const titleRow = ws.addRow([designConditions.project.name || '空気線図 - 状態点一覧']);
  titleRow.font = { bold: true, size: 14 };
  ws.mergeCells(titleRow.number, 1, titleRow.number, 11);

  // プロジェクト情報
  const infoItems = [
    designConditions.project.location,
    designConditions.project.date,
    designConditions.project.designer,
  ].filter(Boolean);
  if (infoItems.length > 0) {
    const infoRow = ws.addRow([infoItems.join(' | ')]);
    infoRow.font = { size: 9, color: { argb: 'FF6B7280' } };
    ws.mergeCells(infoRow.number, 1, infoRow.number, 11);
  }

  // 空行
  ws.addRow([]);

  // 設計条件サマリー
  const condTitleRow = ws.addRow(['設計条件']);
  condTitleRow.font = { bold: true, size: 11 };
  ws.mergeCells(condTitleRow.number, 1, condTitleRow.number, 11);
  condTitleRow.getCell(1).fill = subHeaderFill;
  condTitleRow.getCell(1).font = { ...subHeaderFont, size: 11 };

  const oc = designConditions.outdoor;
  const ic = designConditions.indoor;
  const af = designConditions.airflow;

  ws.addRow([
    '外気(夏)',
    `${oc.summer.dryBulbTemp}°C / ${oc.summer.relativeHumidity}%`,
    '',
    '室内(夏)',
    `${ic.summer.dryBulbTemp}°C / ${ic.summer.relativeHumidity}%`,
    '',
    '給気量',
    `${af.supplyAir} m³/h`,
  ]);
  ws.addRow([
    '外気(冬)',
    `${oc.winter.dryBulbTemp}°C / ${oc.winter.relativeHumidity}%`,
    '',
    '室内(冬)',
    `${ic.winter.dryBulbTemp}°C / ${ic.winter.relativeHumidity}%`,
    '',
    '外気量',
    `${af.outdoorAir} m³/h`,
  ]);

  // 空行
  ws.addRow([]);

  // ヘッダー行
  const headers = [
    'ラベル',
    '名前',
    '季節',
    '乾球温度\n[°C]',
    '湿球温度\n[°C]',
    '相対湿度\n[%]',
    '絶対湿度\n[kg/kg\']',
    'エンタルピー\n[kJ/kg\']',
    '露点温度\n[°C]',
    '比体積\n[m³/kg\']',
    '風量\n[m³/h]',
  ];
  const headerRow = ws.addRow(headers);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = thinBorder;
  });

  // ラベルカウンター
  let summerCount = 0;
  let winterCount = 0;

  // データ行
  const sorted = [...statePoints].sort((a, b) => a.order - b.order);
  sorted.forEach((point) => {
    let label: string;
    if (point.season === 'summer') {
      summerCount++;
      label = `C${summerCount}`;
    } else if (point.season === 'winter') {
      winterCount++;
      label = `H${winterCount}`;
    } else {
      summerCount++;
      winterCount++;
      label = `C${summerCount}/H${winterCount}`;
    }

    const row = ws.addRow([
      label,
      point.name,
      seasonLabel(point.season),
      point.dryBulbTemp ?? '',
      point.wetBulbTemp ?? '',
      point.relativeHumidity ?? '',
      point.humidity ?? '',
      point.enthalpy ?? '',
      point.dewPoint ?? '',
      point.specificVolume ?? '',
      point.airflow ?? '',
    ]);

    row.eachCell((cell, colNumber) => {
      cell.border = thinBorder;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      // 数値セルのフォーマット
      if (colNumber >= 4 && colNumber <= 11 && typeof cell.value === 'number') {
        if (colNumber === 7) {
          // 絶対湿度: 小数5桁
          cell.numFmt = '0.00000';
        } else if (colNumber === 10) {
          // 比体積: 小数4桁
          cell.numFmt = '0.0000';
        } else if (colNumber === 8) {
          // エンタルピー: 小数2桁
          cell.numFmt = '0.00';
        } else if (colNumber === 11) {
          // 風量: 整数
          cell.numFmt = '#,##0';
        } else {
          // その他: 小数1桁
          cell.numFmt = '0.0';
        }
      }
    });
  });

  // 印刷設定
  ws.pageSetup = {
    paperSize: 9, // A4
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };
}

/**
 * プロセスシートを作成（Excel計算式付き）
 */
function buildProcessesSheet(
  workbook: ExcelJS.Workbook,
  statePoints: StatePoint[],
  processes: Process[],
  designConditions: DesignConditions,
) {
  const ws = workbook.addWorksheet('プロセス一覧');

  // 列幅
  ws.columns = [
    { key: 'A', width: 6 },   // No.
    { key: 'B', width: 16 },  // プロセス名
    { key: 'C', width: 10 },  // 種別
    { key: 'D', width: 8 },   // 季節
    { key: 'E', width: 14 },  // 始点
    { key: 'F', width: 14 },  // 終点
    { key: 'G', width: 14 },  // 風量
    { key: 'H', width: 14 },  // 始点温度
    { key: 'I', width: 14 },  // 終点温度
    { key: 'J', width: 14 },  // 温度差
    { key: 'K', width: 16 },  // 始点絶対湿度
    { key: 'L', width: 16 },  // 終点絶対湿度
    { key: 'M', width: 16 },  // 湿度差
    { key: 'N', width: 16 },  // 始点エンタルピー
    { key: 'O', width: 16 },  // 終点エンタルピー
    { key: 'P', width: 16 },  // エンタルピー差
    { key: 'Q', width: 16 },  // 比体積(始点)
    { key: 'R', width: 14 },  // 質量流量
    { key: 'S', width: 14 },  // 全熱
    { key: 'T', width: 14 },  // 顕熱
    { key: 'U', width: 14 },  // 潜熱
    { key: 'V', width: 10 },  // SHF
    { key: 'W', width: 14 },  // 水量
  ];

  // タイトル行
  const titleRow = ws.addRow([designConditions.project.name || '空気線図 - プロセス一覧']);
  titleRow.font = { bold: true, size: 14 };
  ws.mergeCells(titleRow.number, 1, titleRow.number, 23);

  // 空行
  ws.addRow([]);

  // 定数セクション
  const constTitleRow = ws.addRow(['計算定数']);
  constTitleRow.font = { bold: true, size: 11 };
  constTitleRow.getCell(1).fill = subHeaderFill;
  constTitleRow.getCell(1).font = { ...subHeaderFont, size: 11 };
  ws.mergeCells(constTitleRow.number, 1, constTitleRow.number, 4);

  // 定数値を配置（プロセス計算式から参照できるように）
  const cpAirRow = ws.addRow(['cp_air', 1.006, 'kJ/(kg·K)', '乾き空気の定圧比熱']);
  const cpAirRowNum = cpAirRow.number;
  const cpVRow = ws.addRow(['cp_v', 1.86, 'kJ/(kg·K)', '水蒸気の定圧比熱']);
  const cpVRowNum = cpVRow.number;
  const l0Row = ws.addRow(['L0', 2501, 'kJ/kg', '0°Cにおける蒸発潜熱']);
  const rDaRow = ws.addRow(['R_da', 0.287042, 'kPa·m³/(kg·K)', '乾き空気の気体定数']);
  const pressureRow = ws.addRow(['P_atm', designConditions.outdoor.pressure || 101.325, 'kPa', '大気圧']);
  const waterCpRow = ws.addRow(['cp_water', 4.186, 'kJ/(kg·K)', '水の比熱']);
  const waterCpRowNum = waterCpRow.number;

  // 定数行のスタイル
  [cpAirRow, cpVRow, l0Row, rDaRow, pressureRow, waterCpRow].forEach((row) => {
    row.getCell(1).font = { bold: true, size: 9 };
    row.getCell(2).numFmt = '0.000000';
    row.getCell(3).font = { size: 9, color: { argb: 'FF6B7280' } };
    row.getCell(4).font = { size: 9, color: { argb: 'FF6B7280' } };
  });

  // 空行
  ws.addRow([]);
  ws.addRow([]);

  // ヘッダー行1: カテゴリ
  const catHeaders = [
    '', '', '', '', '始点', '', '風量', '乾球温度', '', '', '絶対湿度', '', '',
    'エンタルピー', '', '', '比体積', '質量流量', '熱量', '', '', 'SHF', '水量',
  ];
  const catRow = ws.addRow(catHeaders);
  catRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = thinBorder;
  });
  // カテゴリのマージ
  const catRowNum = catRow.number;
  ws.mergeCells(catRowNum, 8, catRowNum, 10);   // 乾球温度
  ws.mergeCells(catRowNum, 11, catRowNum, 13);  // 絶対湿度
  ws.mergeCells(catRowNum, 14, catRowNum, 16);  // エンタルピー
  ws.mergeCells(catRowNum, 19, catRowNum, 21);  // 熱量

  // ヘッダー行2: 詳細
  const detailHeaders = [
    'No.',
    'プロセス名',
    '種別',
    '季節',
    '始点名',
    '終点名',
    '[m³/h]',
    '始点\n[°C]',
    '終点\n[°C]',
    '温度差\n[°C]',
    '始点\n[kg/kg\']',
    '終点\n[kg/kg\']',
    '湿度差\n[g/kg\']',
    '始点\n[kJ/kg\']',
    '終点\n[kJ/kg\']',
    '差\n[kJ/kg\']',
    '始点\n[m³/kg\']',
    '[kgDA/s]',
    '全熱\n[kW]',
    '顕熱\n[kW]',
    '潜熱\n[kW]',
    '[-]',
    '[L/min]',
  ];
  const detailRow = ws.addRow(detailHeaders);
  detailRow.height = 30;
  detailRow.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = thinBorder;
  });

  const dataStartRow = detailRow.number + 1;

  // プロセスをorderでソート
  const sortedProcesses = [...processes].sort((a, b) => a.order - b.order);

  sortedProcesses.forEach((process, idx) => {
    const fromPoint = statePoints.find((p) => p.id === process.fromPointId);
    const toPoint = statePoints.find((p) => p.id === process.toPointId);
    const rowNum = dataStartRow + idx;

    // 風量の取得
    let airflow: number | undefined = process.parameters.airflow;
    if (process.type === 'mixing') {
      const s1Id = process.parameters.mixingRatios?.stream1.pointId ?? process.fromPointId;
      const s2Id = process.parameters.mixingRatios?.stream2.pointId;
      const s1 = statePoints.find((p) => p.id === s1Id);
      const s2 = statePoints.find((p) => p.id === s2Id);
      if (typeof s1?.airflow === 'number' && typeof s2?.airflow === 'number') {
        airflow = s1.airflow + s2.airflow;
      }
    }

    // 始点・終点の物性値
    const fromTemp = fromPoint?.dryBulbTemp;
    const toTemp = toPoint?.dryBulbTemp;
    const fromHum = fromPoint?.humidity;
    const toHum = toPoint?.humidity;
    const fromH = fromPoint?.enthalpy;
    const toH = toPoint?.enthalpy;
    const fromV = fromPoint?.specificVolume;

    // Excel列参照（1-indexed → A=1, B=2, ...）
    const col = (c: string) => `${c}${rowNum}`;

    // 静的値の行
    const row = ws.addRow([
      idx + 1,                                    // A: No.
      process.name,                                // B: プロセス名
      processTypeLabels[process.type],             // C: 種別
      seasonLabel(process.season),                 // D: 季節
      fromPoint?.name ?? '不明',                    // E: 始点名
      toPoint?.name ?? '不明',                      // F: 終点名
      airflow ?? '',                               // G: 風量
      fromTemp ?? '',                              // H: 始点温度
      toTemp ?? '',                                // I: 終点温度
      null,                                        // J: 温度差（計算式）
      fromHum ?? '',                               // K: 始点絶対湿度
      toHum ?? '',                                 // L: 終点絶対湿度
      null,                                        // M: 湿度差（計算式）
      fromH ?? '',                                 // N: 始点エンタルピー
      toH ?? '',                                   // O: 終点エンタルピー
      null,                                        // P: エンタルピー差（計算式）
      fromV ?? '',                                 // Q: 比体積
      null,                                        // R: 質量流量（計算式）
      null,                                        // S: 全熱（計算式）
      null,                                        // T: 顕熱（計算式）
      null,                                        // U: 潜熱（計算式）
      null,                                        // V: SHF（計算式）
      null,                                        // W: 水量（計算式）
    ]);

    // ---- Excel計算式を設定 ----

    // J: 温度差 = 終点温度 - 始点温度
    row.getCell('J').value = {
      formula: `IF(OR(${col('I')}="",${col('H')}=""),"",${col('I')}-${col('H')})`,
      result: undefined,
    } as ExcelJS.CellFormulaValue;

    // M: 湿度差 [g/kg'] = (終点湿度 - 始点湿度) * 1000
    row.getCell('M').value = {
      formula: `IF(OR(${col('L')}="",${col('K')}=""),"",(${col('L')}-${col('K')})*1000)`,
      result: undefined,
    } as ExcelJS.CellFormulaValue;

    // P: エンタルピー差 = 終点エンタルピー - 始点エンタルピー
    row.getCell('P').value = {
      formula: `IF(OR(${col('O')}="",${col('N')}=""),"",${col('O')}-${col('N')})`,
      result: undefined,
    } as ExcelJS.CellFormulaValue;

    // Q: 比体積 = R_da * (T+273.15) * (1+1.6078*x) / P
    // (始点物性値そのまま使用 - 計算検証用に式も示す)

    // R: 質量流量 [kgDA/s] = (風量/3600) / 比体積
    row.getCell('R').value = {
      formula: `IF(OR(${col('G')}="",${col('Q')}=""),"",${col('G')}/3600/${col('Q')})`,
      result: undefined,
    } as ExcelJS.CellFormulaValue;

    // S: 全熱 [kW] = 質量流量 * エンタルピー差
    // Q_total = G_dot * Δh
    row.getCell('S').value = {
      formula: `IF(OR(${col('R')}="",${col('P')}=""),"",${col('R')}*${col('P')})`,
      result: undefined,
    } as ExcelJS.CellFormulaValue;

    // T: 顕熱 [kW] = 質量流量 * cp_moist * 温度差
    // cp_moist = cp_air + x_avg * cp_v
    // ここでは定数セルを参照
    row.getCell('T').value = {
      formula: `IF(OR(${col('R')}="",${col('J')}="",${col('K')}="",${col('L')}=""),""` +
        `,${col('R')}*(B$${cpAirRowNum}+(${col('K')}+${col('L')})/2*B$${cpVRowNum})*${col('J')})`,
      result: undefined,
    } as ExcelJS.CellFormulaValue;

    // U: 潜熱 [kW] = 全熱 - 顕熱
    row.getCell('U').value = {
      formula: `IF(OR(${col('S')}="",${col('T')}=""),"",${col('S')}-${col('T')})`,
      result: undefined,
    } as ExcelJS.CellFormulaValue;

    // V: SHF = |顕熱| / |全熱|
    row.getCell('V').value = {
      formula: `IF(OR(${col('S')}="",ABS(${col('S')})<0.000001),"",ABS(${col('T')})/ABS(${col('S')}))`,
      result: undefined,
    } as ExcelJS.CellFormulaValue;

    // W: 水量 [L/min] = |全熱| * 60 / (cp_water * ΔT_water)
    // ΔT_water = waterTempDiff パラメータ (デフォルト 7°C)
    const waterTempDiff = process.parameters.waterTempDiff || 7;
    if (process.type === 'heating' || process.type === 'cooling') {
      row.getCell('W').value = {
        formula: `IF(${col('S')}="","",ABS(${col('S')})*60/(B$${waterCpRowNum}*${waterTempDiff}))`,
        result: undefined,
      } as ExcelJS.CellFormulaValue;
    }

    // 行スタイル
    row.eachCell((cell, colNumber) => {
      cell.border = thinBorder;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };

      // 数値フォーマットの設定
      if (colNumber === 7 || colNumber === 11) {
        // 風量（整数）
        if (colNumber === 7) cell.numFmt = '#,##0';
      }
      if ([8, 9].includes(colNumber)) cell.numFmt = '0.0';       // 温度
      if (colNumber === 10) cell.numFmt = '0.0';                   // 温度差
      if ([11, 12].includes(colNumber)) cell.numFmt = '0.00000';  // 絶対湿度
      if (colNumber === 13) cell.numFmt = '0.00';                  // 湿度差 g/kg
      if ([14, 15].includes(colNumber)) cell.numFmt = '0.00';     // エンタルピー
      if (colNumber === 16) cell.numFmt = '0.00';                  // エンタルピー差
      if (colNumber === 17) cell.numFmt = '0.0000';                // 比体積
      if (colNumber === 18) cell.numFmt = '0.0000';                // 質量流量
      if ([19, 20, 21].includes(colNumber)) cell.numFmt = '0.00'; // 熱量
      if (colNumber === 22) cell.numFmt = '0.00';                  // SHF
      if (colNumber === 23) cell.numFmt = '0.00';                  // 水量
    });

    // 警告行の追加（加熱/冷却でモードが逆の場合）
    if ((process.type === 'heating' || process.type === 'cooling') && fromPoint && toPoint) {
      const capacity = CoilCapacityCalculator.calculate(
        fromPoint,
        toPoint,
        airflow || 1000,
      );
      if (
        (process.type === 'heating' && inferModeFromSigned(capacity.totalCapacity) === 'cooling') ||
        (process.type === 'cooling' && inferModeFromSigned(capacity.totalCapacity) === 'heating')
      ) {
        const warnRow = ws.addRow([
          '',
          `⚠ 運転モードと計算結果が不一致（結果は${
            inferModeFromSigned(capacity.totalCapacity) === 'cooling' ? '冷却' : '加熱'
          }）`,
        ]);
        ws.mergeCells(warnRow.number, 2, warnRow.number, 10);
        warnRow.getCell(2).font = { color: { argb: 'FFDC2626' }, size: 9, italic: true };
      }
    }
  });

  // 計算式の説明セクション
  const formulaStartRow = dataStartRow + sortedProcesses.length + 3;
  ws.getCell(`A${formulaStartRow}`).value = '計算式の説明';
  ws.getCell(`A${formulaStartRow}`).font = { bold: true, size: 11 };
  ws.getCell(`A${formulaStartRow}`).fill = subHeaderFill;
  ws.getCell(`A${formulaStartRow}`).font = { ...subHeaderFont, size: 11 };
  ws.mergeCells(formulaStartRow, 1, formulaStartRow, 8);

  const formulas = [
    ['エンタルピー', 'h = cp_air × T + x × (L0 + cp_v × T)  [kJ/kg\']'],
    ['比体積', 'v = R_da × (T+273.15) × (1+1.6078×x) / P  [m³/kg\']'],
    ['質量流量', 'G = (風量/3600) / v  [kgDA/s]'],
    ['全熱', 'Q_total = G × Δh  [kW]'],
    ['顕熱', 'Q_sensible = G × cp_moist × ΔT  [kW]'],
    ['', '   cp_moist = cp_air + x_avg × cp_v'],
    ['潜熱', 'Q_latent = Q_total - Q_sensible  [kW]'],
    ['SHF', 'SHF = |Q_sensible| / |Q_total|  [-]'],
    ['水量', 'V_water = |Q_total| × 60 / (cp_water × ΔT_water)  [L/min]'],
  ];

  formulas.forEach((f, i) => {
    const r = ws.getRow(formulaStartRow + 1 + i);
    r.getCell(1).value = f[0];
    r.getCell(1).font = { bold: true, size: 9 };
    r.getCell(3).value = f[1];
    r.getCell(3).font = { size: 9, color: { argb: 'FF4B5563' } };
    ws.mergeCells(formulaStartRow + 1 + i, 3, formulaStartRow + 1 + i, 12);
  });

  // 印刷設定
  ws.pageSetup = {
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };
}

/**
 * Excelファイルを生成してダウンロード
 */
export async function exportToExcel(
  statePoints: StatePoint[],
  processes: Process[],
  designConditions: DesignConditions,
  activeSeason: 'summer' | 'winter' | 'both',
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = designConditions.project.designer || '空気線図アプリ';
  workbook.created = new Date();

  // 季節フィルタリング
  const filteredPoints = statePoints
    .filter((p) => {
      if (activeSeason === 'both') return true;
      return p.season === activeSeason || p.season === 'both';
    })
    .sort((a, b) => a.order - b.order);

  const filteredProcesses = processes.filter((p) => {
    if (activeSeason === 'both') return true;
    return p.season === activeSeason || p.season === 'both';
  });

  // シート作成
  buildStatePointsSheet(workbook, filteredPoints, designConditions);
  buildProcessesSheet(workbook, filteredPoints, filteredProcesses, designConditions);

  // ファイル生成とダウンロード
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  const projectName = designConditions.project.name || 'psychrometric';
  const seasonSuffix = activeSeason === 'both' ? '' : `_${seasonLabel(activeSeason)}`;
  link.download = `${projectName}${seasonSuffix}.xlsx`;
  link.click();

  URL.revokeObjectURL(url);
}
