'use strict';

const _ = require('lodash');
const OSS = require('ali-oss');
const which = require('which');
const fs = require('fs');
const WaveFile = require('wavefile').WaveFile;
const {readFile } = require('fs').promises
const Lame = require("node-lame").Lame;
const os = require('os');
const childProcess = require('child_process');
const stream = require('stream');

const THUMBNAIL_SIZE = '480x360';

const log = (...args) => {
  if (process.env.NODE_ENV !== 'production') {
    console.debug('>>>>>>> upload oss <<<<<<<');
    console.debug(...args);
  }
};

const getTmpFilePath = name => `${os.tmpdir()}/${name}`;

module.exports = {
  provider: 'aliyun-oss',
  name: 'Aliyun Web Service OSS',
  auth: {
    accessKeyId: {
      label: 'AccessKeyId token',
      type: 'text'
    },
    accessKeySecret: {
      label: 'AccessKeySecret token',
      type: 'text'
    },
    region: {
      label: 'Region',
      type: 'enum',
      values: [
        "oss-cn-hangzhou",
        "oss-cn-shanghai",
        "oss-cn-qingdao",
        "oss-cn-beijing",
        "oss-cn-zhangjiakou",
        "oss-cn-huhehaote",
        "oss-cn-shenzhen",
        "oss-cn-heyuan",
        "oss-cn-chengdu",
        "oss-cn-hongkong",
        "oss-us-west-1",
        "oss-us-east-1",
        "oss-ap-southeast-1",
        "oss-ap-southeast-2",
        "oss-ap-southeast-3",
        "oss-ap-southeast-5",
        "oss-ap-northeast-1",
        "oss-ap-south-1",
        "oss-eu-central-1",
        "oss-eu-west-1",
        "oss-me-east-1"
      ]
    },
    bucket: {
      label: 'Bucket',
      type: 'text'
    },
    uploadPath: {
      label: 'Upload Path',
      type: 'text'
    },
    baseUrl: {
      label: 'Base URL to access',
      type: 'text'
    },
    autoThumb: {
      label: 'VIDEO FILE ONLY: Automatically generate thumbnails for video (supported format .mp4, thumbnail size 480x360)',
      type: 'enum',
      values: ['no', 'yes']
    },
    timeout: {
      label: 'timeout for oss uploading, unit: seconds',
      type: 'number'
    },
    secure: {
      label: 'Instruct OSS client to use HTTPS or HTTP protocol.',
      type: 'boolean',
    },
  },
  init: (config) => {
    const ossClient = new OSS({
      region: config.region,
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
      bucket: config.bucket,
      timeout: +(config.timeout * 1000),
      secure: !(config.secure === false),
    });

    return {
      upload: (file) => {
        log(file);
        return new Promise((resolve, reject) => {
          // upload file on OSS bucket
          const path = config.uploadPath ? `${config.uploadPath}/` : '';
          const fullVersionFileName = `${file.hash}-full-${Date.now()}${file.ext}`;
          const shortVersionFileName = `${file.hash}.mp3`;
          const fullPath = `${path}${fullVersionFileName}`;
          const shortPath = `${path}${shortVersionFileName}`;
          const fileBuffer = Buffer.from(file.buffer, 'binary');

          const tmpPath = getTmpFilePath(fullVersionFileName);

          const generateThumbnail = () => {
            which('ffmpeg', (err) => {
              if (!err) {
                fs.writeFileSync(tmpPath, fileBuffer);

                const proc = childProcess.spawn('ffmpeg', [
                  '-hide_banner',
                  '-i', tmpPath,
                  '-ss', '00:00:01',
                  '-vframes', '1',
                  '-s', THUMBNAIL_SIZE,
                  '-c:v', 'png',
                  '-f', 'image2pipe',
                  // pipe:1 means output to std out
                  'pipe:1',
                ]);

                proc.stderr.on('data', function (data) {
                  // log errors from ffmpeg
                  log('stderr: ' + data);
                });

                ossClient.putStream(`${path}${file.hash}-${THUMBNAIL_SIZE}.png`, proc.stdout)
                  .then((result) => {
                    // delete tmp file
                    fs.unlinkSync(tmpPath);

                    log('thumbnail generated ok', result);
                  })
                  .catch((err) => {
                    log('thumbnail generation failed', err);
                  });

              } else {
                log('ffmpeg not found, therefore no thumbnails are generated ');
              }
            })
          };

          const bufferStream = new stream.PassThrough();
          const readStream = bufferStream.end(fileBuffer);

          // cut mp3 from 0s to 30s use fluent-ffmpeg, output to stream
          if (file.ext === '.wav') {
            let wav = new WaveFile(fileBuffer);
            let b = wav.toBuffer().slice(0, 30 * wav.fmt.byteRate);
            const duration = wav.chunkSize / wav.fmt.byteRate;
            const cutBuffer = Buffer.from(b);
            const encoder = new Lame({
              "output": "buffer",
              "bitrate": 192
            }).setBuffer(cutBuffer);
            encoder.encode()
            .then(() => {
              const cutbufferMp3 = encoder.getBuffer();

              ossClient.put(shortPath, cutbufferMp3).then((result)=>{
                log('short version wav uploaded ok', result);
                if (config.baseUrl) {
                  // use http protocol by default, but you can configure it as https protocol
                  // deprecate config.domain, use baseUrl to specify protocol and domain.
                  let baseUrl = config.baseUrl.replace(/\/$/, '');
                  let name = (result.name || '').replace(/^\//, '');
                  file.url = `${baseUrl}/${name}`;
                } else {
                  file.url = result.url;
                }
                file.alternativeText = `{{${duration}}}`
                file.caption = fullPath
                ossClient.put(fullPath, fileBuffer)
                .then((result) => {
                  log('long version wav uploaded ok', result);
                  resolve();
                }).catch((err) => {
                  reject(err);
                });
  
              }).catch((err) => {
                reject(err);
              });
            })
          } else{
            ossClient.put(fullPath, fileBuffer)
            .then((result) => {
              log(result);
              if (config.baseUrl) {
                // use http protocol by default, but you can configure it as https protocol
                // deprecate config.domain, use baseUrl to specify protocol and domain.
                let baseUrl = config.baseUrl.replace(/\/$/, '');
                let name = (result.name || '').replace(/^\//, '');
                file.url = `${baseUrl}/${name}`;
              } else {
                file.url = result.url;
              }

              if (config.autoThumb === 'yes' && file.ext === '.mp4') {
                log('start generating thumbnail...');
                // automatically generate thumbnails
                generateThumbnail();
              }

              resolve();
            })
            .catch((err) => {
              reject(err);
            });
          }
        });
      },
      delete: (file) => {
        return new Promise((resolve, reject) => {
          // delete file on OSS bucket
          const path = config.uploadPath ? `${config.uploadPath}/` : '';
          const fullPath = `${path}${file.hash}${file.ext}`;

          ossClient.delete(fullPath)
            .then((resp) => {
              log(resp);
              if (resp.res && /2[0-9]{2}/.test(resp.res.statusCode)) {
                // clean up possible existing thumbnails
                log('clean up possible existing thumbnails...');
                ossClient.delete(`${path}${file.hash}-${THUMBNAIL_SIZE}.png`)
                  .then((result) => log('thumbnail deleted', result))
                  .catch((err) => log('thumbnail deletion error', err))

                resolve();
              } else {
                reject(new Error('OSS file deletion error'));
              }
            })
            .catch((err) => {
              reject(err);
            })
        });
      }
    };
  }
};