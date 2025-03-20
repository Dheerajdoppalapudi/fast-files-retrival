// controllers/bucketController.ts
import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { ApprovalBucketSettingService, ApprovalItemSettingService, getBucketSettingService, getItemSettingService } from '../services/approvalService';


export const ApprovalBucketSetting = async (req: AuthRequest, res: Response) => {

     try {
        const {bucketID}=req.params;
        const body=req.body
        const userId = req.user?.id;
        

        const BucketSetting=await ApprovalBucketSettingService(userId,bucketID,body)

        
        res.status(200).json( BucketSetting );
      }
      catch (error){
        res.status(500).json({ error: (error as Error).message });
      }

      

    
}

export const ApprovalItemSetting = async (req: AuthRequest, res: Response) => {

    try {
       const {ItemID}=req.params;
       const body=req.body
       const userId = req.user?.id;
       

       const BucketSetting=await ApprovalItemSettingService(userId,ItemID,body)

       
       res.status(200).json( BucketSetting );
     }
     catch (error){
       res.status(500).json({ error: (error as Error).message });
     }

     

   
}


export const getBucketSetting = async (req: AuthRequest, res: Response) => {

    try {
       const {bucketID}=req.params;
       const userId = req.user?.id;
       console.log(bucketID)
       

       const BucketSetting=await getBucketSettingService(userId,bucketID)

       
       res.status(200).json( BucketSetting );
     }
     catch (error){
       res.status(500).json({ error: (error as Error).message });
     }

     

   
}

export const getItemSetting = async (req: AuthRequest, res: Response) => {

    try {
       const {ItemID}=req.params;
       const userId = req.user?.id;
       

       const BucketSetting=await getItemSettingService(userId,ItemID)

       
       res.status(200).json( BucketSetting );
     }
     catch (error){
       res.status(500).json({ error: (error as Error).message });
     }

     

   
}