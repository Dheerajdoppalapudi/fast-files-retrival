import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { 
 approveVersionService,rejectVersionService
} from '../services/approveVersionService';


import fs from 'fs';
import pdfParse from 'pdf-parse';


import { 
  downloadVersionsService,
  
   } from '../services/versionService';
import path from 'path';


export const approveVersion = async (req: AuthRequest, res: Response) => {
  try {
    const { versionId } = req.params;
    const userId = req.user?.id;
    const result = await approveVersionService(versionId, userId);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const rejectVersion = async (req: AuthRequest, res: Response) => {
  try {
    const { versionId } = req.params;
    const userId = req.user?.id;
    const result = await rejectVersionService(versionId, userId);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};



export const downloadVersion = async (req: AuthRequest, res: Response) => {
  try {
    const { versionId } = req.params;
    const userId = req.user?.id;
    const object: { objectPath: string,objectName:string } = await downloadVersionsService(versionId, userId);
  
    res.download(object.objectPath, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Error while downloading the file' });
      }
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};




export const ExtractText = async (req: AuthRequest, res: Response) => {
  try {
    const { versionId } = req.params;
    const userId = req.user?.id;

    // Call the service to get the file's path and name
    const object: { objectPath: string, objectName: string } = await downloadVersionsService(versionId, userId);
    
    // Check if the file is a PDF
    const ext = path.extname(object.objectName).toLowerCase();
    const allowedExtensions = ['.pdf'];

    if (!allowedExtensions.includes(ext)) {
      return res.status(400).json({ error: 'Unsupported file format. Only PDF files are allowed.' });
    }

    // Read the PDF file into a buffer
    const pdfBuffer = fs.readFileSync(object.objectPath);

    // Parse the PDF and extract the text
    pdfParse(pdfBuffer).then((data) => {
      const pdfText = data.text; // Extracted text content from the PDF

      // Return the extracted text in the response
      res.json({
        pdfText: pdfText,  // Send the extracted text in the response body
        message: 'Text extracted from the PDF successfully.',
      });
    }).catch((error) => {
      // Handle errors during PDF parsing
      res.status(500).json({ error: 'Error parsing PDF', details: error.message });
      return
    });

  } catch (error) {
    // Handle unexpected errors
    res.status(500).json({ error: (error as Error).message });
    return
  }
};


export const ComparePDF = async (req: AuthRequest, res: Response) => {


    const { versionIdA,versionIdB } = req.params;
    const userId = req.user?.id;

    // Call the service to get the file's path and name
    const objectA: { objectPath: string, objectName: string } = await downloadVersionsService(versionIdA, userId);
    const objectB: { objectPath: string, objectName: string } = await downloadVersionsService(versionIdA, userId);

    
    return


}

