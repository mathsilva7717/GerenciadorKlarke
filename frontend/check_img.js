const fs = require('fs');

const file = 'c:\\Users\\city57070\\Desktop\\KLARKE\\frontend\\public\\logo.png';
const buffer = fs.readFileSync(file);

// PNG width/height are at offsets 16 and 20
const width = buffer.readUInt32BE(16);
const height = buffer.readUInt32BE(20);

console.log(`Dimensions of logo.png: ${width}x${height}`);
