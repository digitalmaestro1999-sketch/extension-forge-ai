// Generates minimal valid PNG files as base64 data URIs and raw binary
// Uses a simple 1-color filled square PNG

function createMinimalPNG(size: number, r: number, g: number, b: number): Uint8Array {
  // Build a minimal valid PNG with a single solid color
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];

  function crc32(data: number[]): number {
    let crc = 0xffffffff;
    for (const byte of data) {
      crc ^= byte;
      for (let i = 0; i < 8; i++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function chunk(type: string, data: number[]): number[] {
    const len = data.length;
    const typeBytes = Array.from(type).map((c) => c.charCodeAt(0));
    const crcData = [...typeBytes, ...data];
    const crc = crc32(crcData);
    return [
      (len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff,
      ...typeBytes,
      ...data,
      (crc >>> 24) & 0xff, (crc >>> 16) & 0xff, (crc >>> 8) & 0xff, crc & 0xff,
    ];
  }

  // IHDR
  const ihdr = [
    (size >>> 24) & 0xff, (size >>> 16) & 0xff, (size >>> 8) & 0xff, size & 0xff, // width
    (size >>> 24) & 0xff, (size >>> 16) & 0xff, (size >>> 8) & 0xff, size & 0xff, // height
    8, // bit depth
    2, // color type (RGB)
    0, // compression
    0, // filter
    0, // interlace
  ];

  // Raw image data: each row has filter byte (0) + RGB pixels
  const rawRows: number[] = [];
  for (let y = 0; y < size; y++) {
    rawRows.push(0); // filter: none
    for (let x = 0; x < size; x++) {
      rawRows.push(r, g, b);
    }
  }

  // Deflate with stored blocks (no compression, simplest valid zlib)
  const deflated = deflateStored(rawRows);

  const ihdrChunk = chunk("IHDR", ihdr);
  const idatChunk = chunk("IDAT", deflated);
  const iendChunk = chunk("IEND", []);

  return new Uint8Array([...signature, ...ihdrChunk, ...idatChunk, ...iendChunk]);
}

function deflateStored(data: number[]): number[] {
  // zlib header: CM=8, CINFO=7, FCHECK
  const cmf = 0x78;
  const flg = 0x01; // FCHECK so (CMF*256+FLG) % 31 == 0

  const blocks: number[] = [];
  const maxBlock = 65535;
  const totalBlocks = Math.ceil(data.length / maxBlock) || 1;

  for (let i = 0; i < totalBlocks; i++) {
    const start = i * maxBlock;
    const end = Math.min(start + maxBlock, data.length);
    const blockData = data.slice(start, end);
    const len = blockData.length;
    const isLast = i === totalBlocks - 1 ? 1 : 0;

    blocks.push(
      isLast,
      len & 0xff, (len >>> 8) & 0xff,
      (~len) & 0xff, (~len >>> 8) & 0xff,
      ...blockData
    );
  }

  // Adler-32 checksum
  let a = 1, b = 0;
  for (const byte of data) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  const adler = ((b << 16) | a) >>> 0;

  return [
    cmf, flg,
    ...blocks,
    (adler >>> 24) & 0xff, (adler >>> 16) & 0xff, (adler >>> 8) & 0xff, adler & 0xff,
  ];
}

export interface ExtensionIcons {
  "icons/icon16.png": Uint8Array;
  "icons/icon48.png": Uint8Array;
  "icons/icon128.png": Uint8Array;
}

/**
 * Generate placeholder PNG icons for a Chrome extension.
 * Uses a primary brand color (default: #00E68A green).
 */
export function generateExtensionIcons(
  r = 0, g = 230, b = 138
): ExtensionIcons {
  return {
    "icons/icon16.png": createMinimalPNG(16, r, g, b),
    "icons/icon48.png": createMinimalPNG(48, r, g, b),
    "icons/icon128.png": createMinimalPNG(128, r, g, b),
  };
}
