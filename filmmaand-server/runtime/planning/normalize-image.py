"""Decode a bounded raster, strip metadata, and emit a static WebP."""
import sys,io,warnings
from PIL import Image,ImageOps
Image.MAX_IMAGE_PIXELS=20_000_000
warnings.simplefilter('error',Image.DecompressionBombWarning)
try:
 im=Image.open(io.BytesIO(sys.stdin.buffer.read(550001)))
 if im.format not in ('JPEG','PNG','WEBP'):raise ValueError('format')
 im.load();im=ImageOps.exif_transpose(im);im.thumbnail((1200,1200))
 im=im.convert('RGBA' if 'A' in im.getbands() else 'RGB')
 im.save(sys.stdout.buffer,format='WEBP',quality=84,method=4)
except Exception:
 sys.exit(1)
