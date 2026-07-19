const https = require('https');
const fs = require('fs');

const url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRJjDWZWvkAm7MVC5aA0vAjS3QMzbgc9CC8ZFJ8v5mHqXKLUBEO5N0xPWKl7MHUMEQ5yZ2_Omv0j42F/pub?gid=2138370345&single=true&output=csv';

https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const lines = data.split('\n');
    const headers = lines[0].split(',');
    
    // Find column indexes
    const statusIdx = headers.findIndex(h => h.match(/status/i));
    const stageIdx = headers.findIndex(h => h.match(/highest stage/i));
    
    let totalDrops = 0;
    let preShortlistDrops = 0;
    let postShortlistPreInterviewDrops = 0;
    let postInterviewDrops = 0;
    let unknownStageDrops = 0;

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',');
      if (row.length < 5) continue;
      
      const status = row[statusIdx] ? row[statusIdx].trim() : '';
      const stage = row[stageIdx] ? row[stageIdx].trim() : '';
      
      // Match STATUS_PATTERNS.dropped logic
      if (status.match(/drop/i) || status.match(/withdrawn/i) || status.match(/not interest/i) || status.match(/declined/i) || status.match(/on.?hold/i)) {
        // Exclude offer drops
        if (status.match(/offer/i)) continue;
        
        totalDrops++;
        
        if (!stage) {
          unknownStageDrops++;
        } else if (stage.match(/^[12]\./)) {
          preShortlistDrops++;
        } else if (stage.match(/^[3]\./) || stage.match(/shortlist/i)) {
          postShortlistPreInterviewDrops++;
        } else if (stage.match(/^[4567]\./) || stage.match(/interview/i)) {
          postInterviewDrops++;
        }
      }
    }
    
    console.log({
      totalDrops,
      preShortlistDrops,
      postShortlistPreInterviewDrops,
      postInterviewDrops,
      unknownStageDrops
    });
  });
});
