const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

async function exportToPDF(rows, title, columns) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    doc.fontSize(18).text(title, { align: 'center' }).moveDown();
    const tableTop = doc.y;
    let currentTop = tableTop;

    columns.forEach(col => {
      doc.fontSize(10).text(col.header, col.x, currentTop, { width: col.width, align: 'left' });
    });
    currentTop += 20;
    rows.forEach(row => {
      columns.forEach(col => {
        doc.fontSize(9).text(String(row[col.key] || ''), col.x, currentTop, { width: col.width });
      });
      currentTop += 20;
      if (currentTop > 700) {
        doc.addPage();
        currentTop = 50;
      }
    });
    doc.end();
  });
}

async function exportToExcel(rows, sheetName) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);
  if (rows.length) {
    worksheet.columns = Object.keys(rows[0]).map(key => ({ header: key, key }));
    rows.forEach(row => worksheet.addRow(row));
  }
  return await workbook.xlsx.writeBuffer();
}

module.exports = { exportToPDF, exportToExcel };
