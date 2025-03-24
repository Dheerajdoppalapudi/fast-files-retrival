// import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import JSZip from 'jszip';
import api from "./api";
// import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs"; // Use legacy version
// import "pdfjs-dist/legacy/build/pdf.worker.mjs"; // Import worker manually

// Set the worker source
// pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.5.141/pdf.worker.min.js";



export const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };


  // export const extractTextFromPDF = async (file) => {
  //     const reader = new FileReader();
  
  //     return new Promise((resolve, reject) => {
  //         reader.onload = async function () {
  //             try {
  //                 const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(reader.result) }).promise;
  //                 let extractedText = "";
  
  //                 for (let i = 1; i <= pdf.numPages; i++) {
  //                     const page = await pdf.getPage(i);
  //                     const content = await page.getTextContent();
  //                     extractedText += content.items.map(item => item.str).join(" ") + "\n";
  //                 }
  
  //                 resolve(extractedText);
  //             } catch (error) {
  //                 reject(error);
  //             }
  //         };
  
  //         reader.onerror = (error) => reject(error);
  //         reader.readAsArrayBuffer(file);
  //     });
  // };
  

// Extract text from DOCX
const extractTextFromDOCX = async (blob) => {
  const arrayBuffer = await blob.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
};

// Extract text from XLSX
const extractTextFromXLSX = async (blob) => {
  const arrayBuffer = await blob.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  let text = "";
  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    text += XLSX.utils.sheet_to_csv(sheet);
  });
  return text;
};

// Extract text from TXT
const extractTextFromTXT = async (blob) => {
  return await blob.text();
};

// Extract text from PPTX
const extractTextFromPPTX = async (blob) => {
  const arrayBuffer = await blob.arrayBuffer();
  const zip = new JSZip();
  const content = await zip.loadAsync(arrayBuffer);

  let text = "";
  const slideFiles = Object.keys(content.files).filter((file) =>
    file.startsWith("ppt/slides/slide")
  );

  for (const slideFile of slideFiles) {
    const slideContent = await content.files[slideFile].async("text");
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(slideContent, "text/xml");
    const textNodes = xmlDoc.getElementsByTagName("a:t");
    for (const node of textNodes) {
      text += node.textContent + "\n";
    }
  }

  return text;
};

const extractTextFromPDF=async(versionID)=>{

  const response=await api.Versions().getExtractText({
    versionID:versionID
  })
  return response.data.pdfText
}

// Function to get MIME type from filename
const getMimeTypeFromFilename = (filename) => {
  const extension = filename.split('.').pop().toLowerCase();
  switch (extension) {
    case "pdf":
      return "application/pdf";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "pptx":
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case "txt":
      return "text/plain";
    default:
      throw new Error("Unsupported file type");
  }
};




// Generic function to extract text based on file type
export const extractText = async (blob, fileType,versionID) => {
  if (!blob) return "";

  
  switch (fileType) {
    case "application/pdf":
      return await extractTextFromPDF(versionID);
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return await extractTextFromDOCX(blob);
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      return await extractTextFromXLSX(blob);
    case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      return await extractTextFromPPTX(blob);
    case "text/plain":
      return await extractTextFromTXT(blob);
    default:
      throw new Error("Unsupported file type");
  }
};

// Function to convert Blob to text with automatic file type detection
export const blobToText = async (blob, filename,versionID) => {
  if (!blob || !filename) return "";

  try {
    const fileType = getMimeTypeFromFilename(filename);
    return await extractText(blob, fileType,versionID);
  } catch (error) {
    console.error("Error extracting text from blob:", error);
    return "";
  }
};