import sharp from 'sharp';

export async function perceptualHash(buffer: Buffer): Promise<string> {
  const { data } = await sharp(buffer)
    .rotate()
    .grayscale()
    .resize(9, 8, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  let bits = '';
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      bits += data[y * 9 + x] < data[y * 9 + x + 1] ? '1' : '0';
    }
  }

  let hex = '';
  for (let index = 0; index < bits.length; index += 4) {
    hex += parseInt(bits.slice(index, index + 4), 2).toString(16);
  }
  return hex;
}

export function hammingHex(left: string, right: string): number {
  if (!left || !right || left.length !== right.length) return 64;
  let distance = 0;
  for (let index = 0; index < left.length; index += 1) {
    let value = parseInt(left[index], 16) ^ parseInt(right[index], 16);
    while (value) {
      distance += value & 1;
      value >>= 1;
    }
  }
  return distance;
}
