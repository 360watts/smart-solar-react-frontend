with open("/home/ubuntu/work/smart-solar-react-frontend/src/components/SiteDataPanel.tsx", "r") as f:
    text = f.read()

text = text.replace("extraAction={", "headerRight={")

with open("/home/ubuntu/work/smart-solar-react-frontend/src/components/SiteDataPanel.tsx", "w") as f:
    f.write(text)

