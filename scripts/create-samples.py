"""Small independent PDF/DOCX fixtures; standard library only."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from html import escape

root = Path(__file__).resolve().parent.parent
samples = root / 'examples'
samples.mkdir(exist_ok=True)
objects = [b'<< /Type /Catalog /Pages 2 0 R >>', b'<< /Type /Pages /Kids [4 0 R 6 0 R 8 0 R] /Count 3 >>', b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
for index in range(3):
    content = f'BT /F1 24 Tf 60 700 Td (MD Hawk PDF - page {index + 1}) Tj 0 -50 Td /F1 14 Tf (Reading, bookmarks and search: sample {index + 1}) Tj ET'.encode()
    objects.append(f'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents {5 + index * 2} 0 R >>'.encode())
    objects.append(b'<< /Length ' + str(len(content)).encode() + b' >>\nstream\n' + content + b'\nendstream')
pdf = b'%PDF-1.4\n'; offsets = [0]
for number, obj in enumerate(objects, 1):
    offsets.append(len(pdf)); pdf += f'{number} 0 obj\n'.encode() + obj + b'\nendobj\n'
xref = len(pdf)
pdf += f'xref\n0 {len(offsets)}\n0000000000 65535 f \n'.encode() + b''.join(f'{offset:010} 00000 n \n'.encode() for offset in offsets[1:])
pdf += f'trailer\n<< /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'.encode()
(samples / 'Проверка PDF.pdf').write_bytes(pdf)

paragraphs = ''.join(f'<w:p><w:r><w:t>{escape(f"Абзац {i}. Word DOCX читается с форматированием, таблицами и изображениями.")}</w:t></w:r></w:p>' for i in range(1, 81))
document = f'''<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
<w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Word — проверка</w:t></w:r></w:p>
<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Жирное начертание</w:t></w:r></w:p>
<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Формат</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>DOCX</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
<w:p><w:r><w:drawing><wp:inline><wp:extent cx="914400" cy="914400"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:blipFill><a:blip r:embed="rId1"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>
<w:p><w:hyperlink r:id="rId2"><w:r><w:t>Опасная ссылка Word</w:t></w:r></w:hyperlink></w:p>
{paragraphs}</w:body></w:document>'''
with ZipFile(samples / 'Проверка Word.docx', 'w', ZIP_DEFLATED) as archive:
    archive.writestr('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>')
    archive.writestr('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
    archive.writestr('word/document.xml', document)
    archive.writestr('word/styles.xml', '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style></w:styles>')
    archive.writestr('word/_rels/document.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/icon.png"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="javascript:alert(1)" TargetMode="External"/></Relationships>')
    archive.write(root / 'assets/icon.png', 'word/media/icon.png')
print('Created three-page PDF and formatted DOCX fixtures.')
