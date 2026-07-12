import re

with open(r'src\routes\index.tsx', 'rb') as f:
    content = f.read()

# The corrupt section: line 1291 ends with \r instead of \r\n then has the TAB4 header embedded
# We need to split the line at the \r before the section header
old = (
    b"background: 'var(--teal-400)', borderRadius: 3, transition: 'width 0.4s ease' }} />\r"
    b"// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\r\n"
    b"//  TAB 4: POSITIONS \xe2\x80\x94 Top positions by pipeline volume\r\n"
    b"// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\r\n"
    b"\r\n"
    b"// Compact position KPI box\r\n"
)
new = (
    b"background: 'var(--teal-400)', borderRadius: 3, transition: 'width 0.4s ease' }} />\r\n"
    b"                            </div>\r\n"
    b"                            <div style={{ width: 26, textAlign: 'center', fontSize: '0.65rem', fontWeight: 600, color: pos.joined > 0 ? 'var(--teal-600)' : 'var(--text-muted)', flexShrink: 0 }}>{pos.joined}</div>\r\n"
    b"                            <div style={{ width: 26, textAlign: 'center', fontSize: '0.65rem', fontWeight: 500, color: pos.dropped > 0 ? 'var(--brick-400)' : 'var(--text-muted)', flexShrink: 0 }}>{pos.dropped}</div>\r\n"
    b"                            <div style={{ width: 32, textAlign: 'right', fontSize: '0.63rem', fontWeight: 600, flexShrink: 0, color: pos.avgDays !== null ? (pos.avgDays <= 30 ? 'var(--teal-600)' : pos.avgDays <= 60 ? 'var(--amber-600)' : 'var(--brick-500)') : 'var(--text-muted)' }}>\r\n"
    b"                              {pos.avgDays !== null ? `${pos.avgDays}d` : '\xe2\x80\x93'}\r\n"
    b"                            </div>\r\n"
    b"                          </div>\r\n"
    b"                        )\r\n"
    b"                      })}\r\n"
    b"\r\n"
    b"                      {/* Mini legend */}\r\n"
    b"                      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.3rem', paddingTop: '0.25rem', borderTop: '1px solid var(--border)' }}>\r\n"
    b"                        {[{ color: 'rgba(15,23,42,0.08)', label: 'Applied' }, { color: 'rgba(251,191,36,0.45)', label: 'Offered' }, { color: 'var(--teal-400)', label: 'Joined' }].map(l => (\r\n"
    b"                          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.57rem', color: 'var(--text-muted)' }}>\r\n"
    b"                            <span style={{ width: 7, height: 7, borderRadius: 2, background: l.color, display: 'inline-block', border: '1px solid var(--glass-border)' }} />\r\n"
    b"                            {l.label}\r\n"
    b"                          </div>\r\n"
    b"                        ))}\r\n"
    b"                      </div>\r\n"
    b"                    </div>\r\n"
    b"                  )}\r\n"
    b"                </div>\r\n"
    b"              )\r\n"
    b"            })}\r\n"
    b"          </div>\r\n"
    b"        ))}\r\n"
    b"      </div>\r\n"
    b"    </div>\r\n"
    b"  )\r\n"
    b"}\r\n"
    b"\r\n"
    b"// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\r\n"
    b"//  TAB 4: POSITIONS \xe2\x80\x94 Top positions by pipeline volume\r\n"
    b"// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\r\n"
    b"\r\n"
    b"// Compact position KPI box\r\n"
)

if old in content:
    content = content.replace(old, new, 1)
    with open(r'src\routes\index.tsx', 'wb') as f:
        f.write(content)
    print("Fixed!")
else:
    # Try to find it differently - search for the CR-only variant
    idx = content.find(b"transition: 'width 0.4s ease' }} />\r//")
    print(f"idx={idx}")
    if idx != -1:
        print(repr(content[idx:idx+100]))
    else:
        print("Pattern not found, looking for bare CR")
        idx2 = content.find(b"/>\r//")
        print(f"idx2={idx2}")
        if idx2 != -1:
            print(repr(content[idx2:idx2+120]))
