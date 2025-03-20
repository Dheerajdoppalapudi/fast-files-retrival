import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export const STORAGE_DIR = path.join(process.env.STORAGE_DIR || '', './storage');

export const getObjectPath = (bucketName: string, key: string, versionId: string): string => {
  const dir = path.join(STORAGE_DIR, bucketName);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, `${key}_${versionId}`);
};

export const calculateETag = async (filePath: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);
    
    stream.on('error', err => reject(err));
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
};

export const deleteFile = (filePath: string): boolean => {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
};
