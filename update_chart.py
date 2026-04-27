import sys

content = open('src/components/SiteDataPanel.tsx', 'r').read()

old_block = """                  {(() => {
                    const fcData = loadForecast.map((r: any) => {
                      const d = new Date(r.forecast_for);
                      return {
                        time: d.toLocaleDateString([], { weekday: 'short', day: 'numeric', timeZone: IST }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: IST }),
                        load: r.predicted_kw != null ? +Number(r.predicted_kw).toFixed(2) : null,
                      };
                    });
                    return (
                      <CJLine
                        data={{
                          labels: fcData.map(d => d.time),
                          datasets: [{
                            label: 'Forecast Load',
                            data: fcData.map(d => d.load),
                            borderColor: '#ef4444', borderWidth: 2.2, tension: 0.4, pointRadius: 0,
                            fill: true,
                            backgroundColor: (ctx: any) => { const { chart } = ctx; if (!chart.chartArea) return '#ef444430'; return makeGradient(chart.ctx, chart.chartArea, '#ef4444', 0.45, 0.02); },
                          }],
                        }}"""

new_block = """                  {(() => {
                    const fcData = loadForecast.map((r: any) => {
                      const d = new Date(r.forecast_for);
                      return {
                        time: d.toLocaleDateString([], { weekday: 'short', day: 'numeric', timeZone: IST }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: IST }),
                        load: r.predicted_kw != null ? +Number(r.predicted_kw).toFixed(2) : null,
                        p10: r.p10_kw != null ? +Number(r.p10_kw).toFixed(2) : null,
                        p90: r.p90_kw != null ? +Number(r.p90_kw).toFixed(2) : null,
                      };
                    });
                    return (
                      <CJLine
                        data={{
                          labels: fcData.map(d => d.time),
                          datasets: [
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
                          ],
                        }}"""

content = content.replace(old_block, new_block)

old_tooltip = """                            tooltip: {
                              backgroundColor: isDark ? 'rgba(30,41,59,0.97)' : 'rgba(255,255,255,0.97)',
                              titleColor: isDark ? '#e2e8f0' : '#334155', bodyColor: isDark ? '#94a3b8' : '#374151',
                              borderColor: 'rgba(239,68,68,0.2)', borderWidth: 1, padding: 12, cornerRadius: 10,
                              bodyFont: { family: 'JetBrains Mono, monospace', size: 11 },
                              callbacks: { label: (item: TooltipItem<'line'>) => ` Forecast Load: ${Number(item.parsed.y).toFixed(2)} kW` },
                            },"""

new_tooltip = """                            tooltip: {
                              backgroundColor: isDark ? 'rgba(30,41,59,0.97)' : 'rgba(255,255,255,0.97)',
                              titleColor: isDark ? '#e2e8f0' : '#334155', bodyColor: isDark ? '#94a3b8' : '#374151',
                              borderColor: 'rgba(239,68,68,0.2)', borderWidth: 1, padding: 12, cornerRadius: 10,
                              bodyFont: { family: 'JetBrains Mono, monospace', size: 11 },
                              callbacks: { 
                                label: (item: TooltipItem<'line'>) => ` ${item.dataset.label}: ${Number(item.parsed.y).toFixed(2)} kW`
                              },
                            },"""

content = content.replace(old_tooltip, new_tooltip)

open('src/components/SiteDataPanel.tsx', 'w').write(content)
