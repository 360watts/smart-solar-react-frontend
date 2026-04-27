with open("/home/ubuntu/work/smart-solar-react-frontend/src/components/SiteDataPanel.tsx", "r") as f:
    text = f.read()

def assert_replace(o, n):
    global text
    if o not in text:
        print("COULD NOT FIND:", repr(o))
    else:
        text = text.replace(o, n)

assert_replace(
    'const vsActualChartRef = useRef<any>(null);',
    'const vsActualChartRef = useRef<any>(null);\n  const loadForecastChartRef = useRef<any>(null);'
)

assert_replace(
    'const [vsActualIsZoomed, setVsActualIsZoomed] = useState(false);',
    'const [vsActualIsZoomed, setVsActualIsZoomed] = useState(false);\n  const [loadForecastIsZoomed, setLoadForecastIsZoomed] = useState(false);'
)

assert_replace(
    'const onVsActualZoom = useRef(() => setVsActualIsZoomed(true));',
    'const onVsActualZoom = useRef(() => setVsActualIsZoomed(true));\n  const onLoadForecastZoom = useRef(() => setLoadForecastIsZoomed(true));'
)

o_opts = "callbacks: { label: (item: TooltipItem<'line'>) => ` ${item.dataset.label}: ${Number(item.parsed.y).toFixed(2)} kW` },\n                            },\n                          },\n                          scales: {"
n_opts = "callbacks: { label: (item: TooltipItem<'line'>) => ` ${item.dataset.label}: ${Number(item.parsed.y).toFixed(2)} kW` },\n                            },\n                            zoom: { zoom: { wheel: { enabled: true, speed: 0.08 }, drag: { enabled: false }, pinch: { enabled: false }, mode: 'x', onZoomComplete: () => onLoadForecastZoom.current() }, pan: { enabled: true, mode: 'x', onPanComplete: () => onLoadForecastZoom.current() } },\n                          },\n                          scales: {"

assert_replace(o_opts, n_opts)

o_cj = "return (\n                    <CJLine\n                      data={{labels:"
n_cj = "return (\n                    <CJLine ref={loadForecastChartRef}\n                      data={{labels:"

assert_replace(o_cj, n_cj)

o_cc = "<ChartCard\n                title=\"7-Day Load Forecast\"\n                subtitle=\"Predictive load forecasting\"\n                isDark={isDark}\n                isLive={false}\n                height={340}\n              >"
n_cc = "<ChartCard\n                title=\"7-Day Load Forecast\"\n                subtitle=\"Predictive load forecasting\"\n                isDark={isDark}\n                isLive={false}\n                height={340}\n                extraAction={\n                  loadForecastIsZoomed ? (\n                    <button\n                      className=\"px-2 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-md text-red-600 bg-red-50 hover:bg-red-100 transition-colors border border-red-200 shadow-sm\"\n                      onClick={() => { loadForecastChartRef.current?.resetZoom(); setLoadForecastIsZoomed(false); }}\n                    >\n                      Reset View\n                    </button>\n                  ) : null\n                }\n              >"
assert_replace(o_cc, n_cc)

with open("/home/ubuntu/work/smart-solar-react-frontend/src/components/SiteDataPanel.tsx", "w") as f:
    f.write(text)

print("done")
