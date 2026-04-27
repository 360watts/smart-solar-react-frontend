with open("/home/ubuntu/work/smart-solar-react-frontend/src/components/SiteDataPanel.tsx", "r") as f:
    text = f.read()

# Add to PhaseLoadTab
old_decl = "const [phaseForecastSubTab, setPhaseForecastSubTab] = useState<'chart' | 'accuracy'>('chart');"
new_decl = old_decl + "\n  const loadForecastChartRef = useRef<any>(null);\n  const [loadForecastIsZoomed, setLoadForecastIsZoomed] = useState(false);\n  const onLoadForecastZoom = useRef(() => setLoadForecastIsZoomed(true));"
text = text.replace(old_decl, new_decl)

with open("/home/ubuntu/work/smart-solar-react-frontend/src/components/SiteDataPanel.tsx", "w") as f:
    f.write(text)

