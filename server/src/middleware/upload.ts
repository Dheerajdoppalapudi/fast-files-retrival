// import multer from 'multer';
// import path from 'path';

// export const upload = multer({ dest: path.join("C:\Users\ankit\OneDrive\Desktop\payload\Demo2\server", '../../storage/temp') });


import multer from 'multer';
import path from 'path';
import fs from 'fs';

interface StorageEngine {
    _handleFile: (req: Express.Request, file: Express.Multer.File, cb: (error?: any, info?: Partial<Express.Multer.File>) => void) => void;
    _removeFile: (req: Express.Request, file: Express.Multer.File, cb: (error: Error) => void) => void;
}

const storage: StorageEngine = multer.diskStorage({
    destination: (req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
      
        const uploadDir = './uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir); // Temporary storage before moving to final location


    },
    filename: (req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

export const upload = multer({ 
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, 
  }
});