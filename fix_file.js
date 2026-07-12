const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'routes', 'index.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Find the corrupted section by looking for the bare \r pattern
// The corruption is: teal-400 div close then \r then section header all on one physical line
const corruptPattern = /background: 'var\(--teal-400\)', borderRadius: 3, transition: 'width 0\.4s ease' \} \} \/>\r\/\/ \u2550+\r\n\/\/  TAB 4[^\n]*\n\/\/ \u2550+\r\n\r\n\/\/ Compact position KPI box\r\n/;

if (corruptPattern.test(content)) {
  console.log("Found corruption pattern, fixing...");
  content = content.replace(corruptPattern, 
    "background: 'var(--teal-400)', borderRadius: 3, transition: 'width 0.4s ease' }} />\r\n                            </div>\r\n                            <div style={{ width: 26, textAlign: 'center', fontSize: '0.65rem', fontWeight: 600, color: pos.joined > 0 ? 'var(--teal-600)' : 'var(--text-muted)', flexShrink: 0 }}>{pos.joined}</div>\r\n                            <div style={{ width: 26, textAlign: 'center', fontSize: '0.65rem', fontWeight: 500, color: pos.dropped > 0 ? 'var(--brick-400)' : 'var(--text-muted)', flexShrink: 0 }}>{pos.dropped}</div>\r\n                            <div style={{ width: 32, textAlign: 'right', fontSize: '0.63rem', fontWeight: 600, flexShrink: 0, color: pos.avgDays !== null ? (pos.avgDays <= 30 ? 'var(--teal-600)' : pos.avgDays <= 60 ? 'var(--amber-600)' : 'var(--brick-500)') : 'var(--text-muted)' }}>\r\n                              {pos.avgDays !== null ? `${pos.avgDays}d` : '\u2013'}\r\n                            </div>\r\n                          </div>\r\n                        )\r\n                      })}\r\n\r\n                      {/* Mini legend */}\r\n                      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.3rem', paddingTop: '0.25rem', borderTop: '1px solid var(--border)' }}>\r\n                        {[{ color: 'rgba(15,23,42,0.08)', label: 'Applied' }, { color: 'rgba(251,191,36,0.45)', label: 'Offered' }, { color: 'var(--teal-400)', label: 'Joined' }].map(l => (\r\n                          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.57rem', color: 'var(--text-muted)' }}>\r\n                            <span style={{ width: 7, height: 7, borderRadius: 2, background: l.color, display: 'inline-block', border: '1px solid var(--glass-border)' }} />\r\n                            {l.label}\r\n                          </div>\r\n                        ))}\r\n                      </div>\r\n                    </div>\r\n                  )}\r\n                </div>\r\n              )\r\n            })}\r\n          </div>\r\n        ))}\r\n      </div>\r\n    </div>\r\n  )\r\n}\r\n\r\n// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\r\n//  TAB 4: POSITIONS \u2014 Top positions by pipeline volume\r\n// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\r\n\r\n// Compact position KPI box\r\n"
  );
  fs.writeFileSync(filePath, content, 'utf8');
  console.log("Fixed and written!");
} else {
  // Try to find it
  const idx = content.indexOf("transition: 'width 0.4s ease' }} />\r//");
  console.log("idx:", idx);
  if (idx !== -1) {
    console.log("Context:", JSON.stringify(content.slice(idx, idx + 200)));
  }
}
