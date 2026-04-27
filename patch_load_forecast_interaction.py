import re
import os

file_path = "/home/ubuntu/work/smart-solar-react-frontend/src/components/SiteDataPanel.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add refs and state for zoom
refs_pattern = r"(const vsActualChartRef = useRef<any>\(null\);)"
refs_repl = r"\1\n  const loadForecastChartRef = useRef<any>(null);"

zoomed_pattern = r"(const \[vsActualIsZoomed, setVsActualIsZoomed\] = useState\(false\);)"
zoomed_repl = r"\1\n  const [loadForecastIsZoomed, setLoadForecastIsZoomed] = useState(false);"

on_zoom_pattern = r"(const onVsActualZoom = useRef\(\(\) => setVsActualIsZoomed\(true\)\);)"
on_zoom_repl = r"\1\n  const onLoadForecastZoom = useRef(() => setLoadForecastIsZoomed(true));"

content = re.sub(refs_pattern, refs_repl, content)
content = re.sub(zoomed_pattern, zoomed_repl, content)
content = re.sub(on_zoom_pattern, on_zoom_repl, content)

# 2. Add ref to CJLine for load forecast
cjline_pattern = r"(<CJLine\s+data=\{[^{}]*\}\s+options=\{)"
# wait, there's multiple CJLine, let's target the exact string pattern

load_forecast_chart_target = r"(return \(\s*<CJLine\s*data=\{\{\s*labels:[^{}]*,\s*datasets:\s*\[[\s\S]*?(fill:\s*'-1',\s*backgroundColor:\s*'rgba\(239,68,68,0\.15\)',\s*\}\s*\],\s*\}\}\s*options=\{\{\s*)([\s\S]*?)(plugins: \{)([\s\S]*?)(tooltip: \{)"

load_forecast_chart_repl = r"\1\3\4\n                            zoom: { zoom: { wheel: { enabled: true, speed: 0.08 }, drag: { enabled: false }, pinch: { enabled: false }, mode: 'x', onZoomComplete: () => onLoadForecastZoom.current() }, pan: { enabled: true, mode: 'x', onPanComplete: () => onLoadForecastZoom.current() } },\n                            \5\6"

content = re.sub(load_forecast_chart_target, load_forecast_chart_repl, content)

# Add ref to Load Forecast CJLine
cjline_ref_target = r"(return \(\s*<CJLine)(\s*data=\{\{)"
cjline_ref_repl = r"\1 ref={loadForecastChartRef}\2"
# Make sure we only do it on the load forecast one. The one inside "7-Day Load Forecast / Accuracy (sub-tab)" -> phaseLoadSubTab === 'forecast'
# Let's find a more precise target for the ref
def add_ref_to_load_forecast(match):
    return match.group(1) + " ref={loadForecastChartRef}" + match.group(2)

# It's inside the iffy IIFE: `(() => { if (!fcData.length) return null; return ( <CJLine`
iife_cj_line_target = r"(return \(\s*<CJLine)(.*?fcData\.map)"
content = re.sub(iife_cj_line_target, add_ref_to_load_forecast, content, count=1)


# 3. Add reset button to ChartCard header for 7-Day Load Forecast
reset_button_target = r'(<ChartCard\n\s*title="7-Day Load Forecast"[^>]*>)'

# We need to inject the extra action inside ChartCard or next to the title header if ChartCard supports it.
# Actually in SiteDataPanel, reset buttons are usually in `extraAction` of ChartCard.
chart_card_target = r'(<ChartCard\n\s*title="7-Day Load Forecast"\n\s*subtitle="Predictive load forecasting"\n\s*isDark=\{isDark\}\n\s*isLive=\{false\}\n\s*height=\{340\}\n\s*)(>)'

extra_action_content = r'''extraAction={
                  loadForecastIsZoomed ? (
                    <button
                      className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-md text-red-600 bg-red-50 hover:bg-red-100 transition-colors border border-red-200 shadow-sm"
                      onClick={() => { loadForecastChartRef.current?.resetZoom(); setLoadForecastIsZoomed(false); }}
                    >
                      Reset View
                    </button>
                  ) : null
                }
                \2'''

content = re.sub(chart_card_target, extra_action_content, content, count=1)


with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("done")
