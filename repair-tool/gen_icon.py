import sys
import subprocess
try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pillow"])
    from PIL import Image, ImageDraw, ImageFont

# Create a 256x256 image with transparent background
img = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# Draw a circle for the base (Cyan with Royal Blue border)
draw.ellipse((10, 10, 246, 246), fill=(0, 209, 255, 255), outline=(26, 83, 255, 255), width=10)

# Draw 'K' in the middle
try:
    font = ImageFont.truetype("arialbd.ttf", 150)
except IOError:
    font = ImageFont.load_default()

draw.text((128, 120), "K", font=font, fill=(26, 83, 255, 255), anchor="mm")

# Save as ICO
img.save("c:/Users/city57070/Desktop/KLARKE/repair-tool/icon.ico", format="ICO", sizes=[(256, 256)])
print("Icon generated successfully.")
