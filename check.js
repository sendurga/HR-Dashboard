const fs = require('fs');

function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current); current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

function parseCSV(text) {
  const lines = text.replace(/\r/g, '').trim().split('\n')
  if (lines.length < 2) return []
  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase().replace(/\s+/g, ' '))
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const values = parseCSVLine(line)
    const row = {}
    headers.forEach((h, idx) => { row[h] = (values[idx] || '').trim() })
    rows.push(row)
  }
  return rows
}

fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vRJjDWZWvkAm7MVC5aA0vAjS3QMzbgc9CC8ZFJ8v5mHqXKLUBEO5N0xPWKl7MHUMEQ5yZ2_Omv0j42F/pub?gid=2138370345&single=true&output=csv')
  .then(res => res.text())
  .then(text => {
    const lines = text.replace(/\r/g, '').trim().split('\n');
    console.log("Total raw lines in file:", lines.length);
    const rows = parseCSV(text);
    console.log("Total rows from parseCSV:", rows.length);
    const validRows = rows.filter(r => Object.values(r).some(v => v !== ''));
    console.log("Total valid rows (Total Applicants):", validRows.length);
    
    // Inspect the last 10 rows
    for (let i = rows.length - 10; i < rows.length; i++) {
        const r = rows[i];
        if (!r) continue;
        console.log(`Row ${i}: `, Object.values(r).slice(0,3).join(' | '));
    }
  });
