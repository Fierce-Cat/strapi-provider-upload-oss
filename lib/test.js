const {readFile} = require('fs/promises');
const fs = require('fs');
const { mainModule } = require('process');
const WaveFile = require('wavefile').WaveFile;
async function main() {
  const fileBuffer = await readFile(__dirname + '/test.wav');
  let wav = new WaveFile(fileBuffer);
  console.log(wav);
  let b = wav.toBuffer().slice(0, 30 * wav.fmt.byteRate);
  const duration = wav.chunkSize / wav.fmt.byteRate;
  const cutBuffer = Buffer.from(b);
  fs.writeFileSync(__dirname +  '/test-rest.wav', cutBuffer);
}

main();