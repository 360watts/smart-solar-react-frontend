import sys, re

content = open('src/components/SiteDataPanel.tsx', 'r').read()

# 1. Add p10 and p90 variables
content = re.sub(
    r"(load:\s+r\.predicted_kw\s+!=\s+null\s+\?\s+\+Number\(r\.predicted_kw\)\.toFixed\(2\)\s+:\s+null,)",
    r"\1\n                        p10: r.p10_kw != null ? +Number(r.p10_kw).toFixed(2) : null,\n                        p90: r.p90_kw != null ? +Number(r.p90_kw).toFixed(2) : null,",
    content
)

# 2. Replace datasets
old_datasets = r"datasets:\s+\[\{\s+label:\s+'Forecast Load',\s+data:\s+fcData\.map\(d => d\.load\),\s+borderColor:\s+'#ef4444',\s+borderWidth:\s+2\.2,\s+tension:\s+0\.4,\s+pointRadius:\s+0,\s+fill:\s+true,\s+backgroundColor:\s+\(ctx:\s+any\)\s+=>\s+\{\s+const\s+\{\s+chart\s+\}\s+=\s+ctx;\s+if\s+\(!chart\.chartArea\)\s+return\s+'#ef444430';\s+return\s+makeGradient\(chart\.ctx,\s+chart\.chartArea,\s+'#ef4444',\s+0\.45,\s+0\.02\);\s+\},\s+\}\],"
new_datasets = """datasets: [
                            {
                              label: 'P10',
                              data: fcData.map(d => d.p10),
                              borderColor: 'transparent', borderWidth: 0, tension: 0.4, pointRadius: 0, fill: false,
                            },
                            {
                              label: 'Forecast Load (P50)',
                              data: fcData.map(d => d.load),
                              borderColor: '#ef4444', borderWidth: 2.2, tension: 0.4, pointRadius: 0,
                              fill: '-1',
                              backgroundColor: 'rgba(239,68,68,0.15)',
                            },
                            {
                              label: 'P90',
                              data: fcData.map(d => d.p90),
                              borderColor: 'transparent', borderWidth: 0, tension: 0.4, pointRadius: 0,
                              fill: '-1',
                              backgroundColor: 'rgba(239,68,68,0.15)',
                            }
                          ],"""
content = re.sub(old_datasets, new_datasets, content)

# 3. Fix tooltip
content = re.sub(
    r"callbacks:\s+\{\s+label:\s+\(item:\s+TooltipItem<'line'>\)\s+=>\s+`\s+Forecast Load:\s+\$\{Number\(item\.parsed\.y\)\.toFixed\(2\)\}\s+kW`\s+\},",
    r"callbacks: { label: (item: TooltipItem<'line'>) => ` ${item.dataset.label}: ${Number(item.parsed.y).toFixed(2)} kW` },",
    content
)

open('src/components/SiteDataPanel.tsx', 'w').write(content)
