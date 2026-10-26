"""Read cached government workbook cell values without executing formulas/macros."""
import posixpath
import re
import zipfile
from xml.etree import ElementTree as ET

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}


def read_workbook(path):
    with zipfile.ZipFile(path) as archive:
        shared = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            root = ET.fromstring(archive.read('xl/sharedStrings.xml'))
            shared = [''.join(node.itertext()) for node in root.findall('m:si', NS)]
        rels = ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))
        targets = {node.attrib['Id']: node.attrib['Target'] for node in rels}
        book = ET.fromstring(archive.read('xl/workbook.xml'))
        result = {}
        for sheet in book.findall('m:sheets/m:sheet', NS):
            rel = sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']
            target = targets[rel]
            target = target.lstrip('/') if target.startswith('/') else posixpath.normpath('xl/' + target)
            if not re.fullmatch(r'xl/worksheets/sheet\d+\.xml', target):
                raise ValueError('Unexpected official worksheet path')
            root = ET.fromstring(archive.read(target))
            rows = []
            for row in root.findall('m:sheetData/m:row', NS):
                number = int(row.attrib['r'])
                while len(rows) < number:
                    rows.append([])
                values = rows[number - 1]
                for cell in row.findall('m:c', NS):
                    label = re.match(r'([A-Z]+)\d+$', cell.attrib['r'])
                    if not label:
                        raise ValueError('Malformed source cell coordinate')
                    column = 0
                    for char in label[1]:
                        column = column * 26 + ord(char) - ord('A') + 1
                    while len(values) < column:
                        values.append(None)
                    raw = cell.find('m:v', NS)
                    kind = cell.attrib.get('t')
                    if kind == 'inlineStr':
                        value = ''.join(cell.find('m:is', NS).itertext())
                    elif raw is None or raw.text is None:
                        value = None
                    elif kind == 's':
                        value = shared[int(raw.text)]
                    elif kind == 'b':
                        value = raw.text == '1'
                    elif kind in ('str', 'e'):
                        value = raw.text
                    else:
                        value = float(raw.text) if re.search(r'[.eE]', raw.text) else int(raw.text)
                    values[column - 1] = value
            width = max((len(row) for row in rows), default=0)
            result[sheet.attrib['name']] = [row + [None] * (width - len(row)) for row in rows]
        return result
