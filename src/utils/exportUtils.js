import * as XLSX from 'xlsx';

/**
 * Converts a camelCase string into Title Case.
 * Example: "campaignsByStatus" -> "Campaigns By Status"
 */
function camelToTitleCase(str) {
  const result = str.replace(/([A-Z])/g, " $1");
  return result.charAt(0).toUpperCase() + result.slice(1);
}

/**
 * Formats an array of objects by converting camelCase keys to Title Case headers.
 */
function formatDataForExport(data) {
  if (!data || !data.length) return [];
  return data.map(row => {
    const formattedRow = {};
    for (const key in row) {
      formattedRow[camelToTitleCase(key)] = row[key];
    }
    return formattedRow;
  });
}

/**
 * Exports multiple datasets as separate sheets in a single Excel file (.xlsx).
 * @param {Object} datasets - An object where keys are sheet names and values are arrays of objects (the data).
 * @param {string} filename - The name of the downloaded file (e.g., 'Analytics_Report.xlsx').
 */
export function exportToExcel(datasets, filename) {
  const workbook = XLSX.utils.book_new();

  for (const [sheetName, data] of Object.entries(datasets)) {
    if (data && data.length > 0) {
      const formattedData = formatDataForExport(data);
      const worksheet = XLSX.utils.json_to_sheet(formattedData);
      
      // Auto-size columns slightly for better readability
      const colWidths = Object.keys(formattedData[0]).map(key => ({ wch: Math.max(key.length, 15) }));
      worksheet['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    }
  }

  // If no valid data was provided, don't generate an empty broken file
  if (workbook.SheetNames.length === 0) {
    console.warn("Export failed: No valid data available to export.");
    return;
  }

  XLSX.writeFile(workbook, filename);
}
