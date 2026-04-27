import re

with open("/home/ubuntu/work/smart-solar-react-frontend/src/components/SiteDataPanel.tsx", "r") as f:
    text = f.read()

# remove duplicates
text = text.replace("  const loadForecastChartRef = useRef<any>(null);\n  const loadForecastChartRef = useRef<any>(null);", "  const loadForecastChartRef = useRef<any>(null);")
text = text.replace("  const [loadForecastIsZoomed, setLoadForecastIsZoomed] = useState(false);\n  const [loadForecastIsZoomed, setLoadForecastIsZoomed] = useState(false);", "  const [loadForecastIsZoomed, setLoadForecastIsZoomed] = useState(false);")
text = text.replace("  const onLoadForecastZoom = useRef(() => setLoadForecastIsZoomed(true));\n  const onLoadForecastZoom = useRef(() => setLoadForecastIsZoomed(true));", "  const onLoadForecastZoom = useRef(() => setLoadForecastIsZoomed(true));")

# maybe it was replaced globally. 
# Let's just fix it automatically using a simple regex since I saw the error output line 3863 - 3864.
# Let's simply remove the multiple definitions.
# Wait, the error is at line 3863 - 3864. Let's just delete the 2nd one.

text = re.sub(r'(\s*const loadForecastChartRef = useRef<any>\(null\);){2,}', r'\1', text)
text = re.sub(r'(\s*const \[loadForecastIsZoomed, setLoadForecastIsZoomed\] = useState\(false\);){2,}', r'\1', text)
text = re.sub(r'(\s*const onLoadForecastZoom = useRef\(\(\) => setLoadForecastIsZoomed\(true\)\);){2,}', r'\1', text)

with open("/home/ubuntu/work/smart-solar-react-frontend/src/components/SiteDataPanel.tsx", "w") as f:
    f.write(text)

