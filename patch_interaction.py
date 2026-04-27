with open("/home/ubuntu/work/smart-solar-react-frontend/src/components/SiteDataPanel.tsx", "r") as f:
    text = f.read()

# 1
old_ref = "const vsActualChartRef = useRef<any>(null);"
new_ref = old_ref + "\n  const loadForecastChartRef = useRef<any>(null);"
text = text.replace(old_ref, new_ref)

old_state = "const [vsActualIsZoomed, setVsActualIsZoomed] = useState(false);"
new_state = old_state + "\n  const [loadForecastIsZoomed, setLoadForecastIsZoomed] = useState(false);"
text = text.replace(old_state, new_state)

old_zoom = "const onVsActualZoom = useRef(() => setVsActualIsZoomed(true));"
new_zoom = old_zoom + "\n  const onLoadForecastZoom = useRef(() => setLoadForecastIsZoomed(true));"
text = text.replace(old_zoom, new_zoom)

# 2
old_options = """                              callbacks: { label: (item: TooltipItem<'line'>) => ` ${item.dataset.label}: ${Number(item.parsed.y).toFixed(2)} kW` },
                            },
                          },
                          scales: {"""
new_options = """                              callbacks: { label: (item: TooltipItem<'line'>) => ` ${item.dataset.label}: ${Number(item.parsed.y).toFixed(2)} kW` },
                            },
                            zoom: { zoom: { wheel: { enabled: true, speed: 0.08 }, drag: { enabled: false }, pinch: { enabled: false }, mode: 'x', onZoomComplete: () => onLoadForecastZoom.current() }, pan: { enabled: true, mode: 'x', onPanComplete: () => onLoadForecastZoom.current() } },
                          },
                          scales: {"""
text = text.replace(old_options, new_options)

# 3
old_cjline = "return (\n                    <CJLine"
new_cjline = "return (\n                    <CJLine ref={loadForecastChartRef}"
text = text.replace(old_cjline, new_cjline)

# 4
old_chart_card = """<ChartCard
                title="7-Day Load Forecast"
                subtitle="Predictive load forecasting"
                isDark={isDark}
                isLive={false}
                height={340}
              >"""
new_chart_card = """<ChartCard
                title="7-Day Load Forecast"
                subtitle="Predictive load forecasting"
                isDark={isDark}
                isLive={false}
                height={340}
                extraAction={
                  loadForecastIsZoomed ? (
                    <button
                      className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-md text-red-600 bg-red-50 hover:bg-red-100 transition-colors border border-red-200 shadow-sm"
                      onClick={() => { loadForecastChartRef.current?.resetZoom(); setLoadForecastIsZoomed(false); }}
                    >
                      Reset View
                    </button>
                  ) : null
                }
              >"""
text = text.replace(old_chart_card, new_chart_card)

with open("/home/ubuntu/work/smart-solar-react-frontend/src/components/SiteDataPanel.tsx", "w") as f:
    f.write(text)

