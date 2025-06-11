const fs = require('fs');
const path = require('path');
const { DOMParser } = require('xmldom');
const xpath = require('xpath');

/**
 * Extracts text from a node, including its children.
 * @param {Node} node The node to extract text from.
 * @returns {string} The extracted text.
 */
function getNodeText(node) {
    let text = '';
    if (node) {
        for (let i = 0; i < node.childNodes.length; i++) {
            const child = node.childNodes[i];
            if (child.nodeType === 3) { // Text node
                text += child.nodeValue;
            } else if (child.nodeType === 1) { // Element node
                text += getNodeText(child);
            }
        }
    }
    return text.trim();
}

/**
 * Parses a <w:p> element into a pattern item object.
 * @param {Node} pNode The <w:p> node.
 * @param {function} select The xpath selector.
 * @returns {object} The parsed pattern item.
 */
function parseItem(pNode, select) {
    const item = {
        abbr: '',
        strategy: '',
        window_level: '',
        best_seen_on: '',
        full_name: '',
        groupID: 0,
        chunkID: 0,
        chapter: ''
    };

    const runs = select('.//w:r', pNode);
    let strategyParts = [];
    let subparts = '';

    runs.forEach(run => {
        const textNode = select('.//w:t', run)[0];
        if (!textNode) return;

        const text = getNodeText(textNode);
        const rPr = select('.//w:rPr', run)[0];
        let isBold = false;
        let color = '000000'; // Default to black

        if (rPr) {
            isBold = select('.//w:b', rPr).length > 0;
            const colorNode = select('.//w:color', rPr)[0];
            if (colorNode) {
                color = colorNode.getAttribute('w:val').toUpperCase();
            }
        }

        if (isBold && (color === '5B9BD5' || color === '4472C4')) { // Bold and Blue
            const parts = text.split(/\s+/);
            item.best_seen_on = parts[0] || '';
            item.window_level = parts[1] || '';
        } else if (text.startsWith('(') && text.endsWith(')')) {
            strategyParts.push(text.slice(1, -1));
        } else if (['7F7F7F', 'BFBFBF', '808080', 'A6A6A6', 'D9D9D9'].includes(color)) { // Gray text for subparts
            subparts += text;
        } else {
            item.abbr += text;
        }
    });

    item.abbr = item.abbr.trim();
    item.full_name = item.abbr;
    if (subparts) {
        strategyParts.push(subparts.trim());
    }
    item.strategy = strategyParts.join(', ');

    return item;
}


/**
 * Main conversion function.
 * @param {string} xmlFilePath Path to the XML file.
 * @param {string} outputFilePath Path for the output JSON file.
 */
function convertXmlPattern(xmlFilePath, outputFilePath) {
    console.log(`Starting conversion for ${xmlFilePath}`);
    const xmlContent = fs.readFileSync(xmlFilePath, 'utf-8');

    const doc = new DOMParser().parseFromString(xmlContent);
    const select = xpath.useNamespaces({ "pkg": "http://schemas.microsoft.com/office/2006/xmlPackage", "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main" });

    // Extract word/document.xml from the package
    const documentXmlPart = select('//pkg:part[@pkg:name="/word/document.xml"]/pkg:xmlData/w:document', doc)[0];
    if (!documentXmlPart) {
        console.error("Could not find word/document.xml part in the provided file.");
        return;
    }

    const body = select('./w:body', documentXmlPart)[0];
    const children = select('./*', body); // Select all direct children of body

    let patternItems = [];

    children.forEach(child => {
        if (child.localName === 'p') {
            const item = parseItem(child, select);
            patternItems.push(item);
        } else if (child.localName === 'tbl') {
            const rows = select('.//w:tr', child);
            rows.forEach(row => {
                const cells = select('.//w:tc', row);
                if (cells.length < 2) return;

                const chapterName = getNodeText(cells[0]);
                const itemNodes = select('.//w:p', cells[1]);
                
                itemNodes.forEach(pNode => {
                    const item = parseItem(pNode, select);
                    if (item.abbr) { // Only add if it's a valid item
                        item.chapter = chapterName;
                        patternItems.push(item);
                    }
                });
            });
        }
    });

    const patternName = path.basename(xmlFilePath, '.xml');
    const outputJson = {
        [patternName]: patternItems
    };

    fs.writeFileSync(outputFilePath, JSON.stringify(outputJson, null, 2));
    console.log(`Conversion successful. JSON saved to ${outputFilePath}`);
}

// Command-line execution
if (require.main === module) {
    if (process.argv.length < 3) {
        console.log("Usage: node import-pattern.js <path_to_xml_file>");
        console.log("Example: node scripts/import-pattern.js data/sp_neck_import.xml");
        process.exit(1);
    }

    const xmlFilePath = process.argv[2];
    const outputFileName = path.basename(xmlFilePath, '.xml') + '.json';
    const outputFilePath = path.join(path.dirname(xmlFilePath), outputFileName);
    
    convertXmlPattern(xmlFilePath, outputFilePath);
} 