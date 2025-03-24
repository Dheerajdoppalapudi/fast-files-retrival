class BaseService {
    constructor(baseURL = 'http://localhost:8080/api') {
        this.baseURL = baseURL;
        this.accessToken = localStorage.getItem('accessToken');
        this.refreshToken = localStorage.getItem('refreshToken');
        this.tokenType = 'Bearer';
        this.notificationCallback = null;
    }

    getAuthHeader() {
        return this.accessToken ? { 'Authorization': `${this.tokenType} ${this.accessToken}` } : {};
    }

    formatResponse(success, data = null, message = '', error = null) {
        return {
            success,
            data,
            message,
            error,
            timestamp: new Date().toISOString()
        };
    }

    setNotificationCallback(callback) {
        this.notificationCallback = callback;
    }

    async request(endpoint, options = {}, parseJSON = true) {
        const headers = {
            'Content-Type': 'application/json',
            ...this.getAuthHeader(),
            ...options.headers
        };
    
        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, {
                ...options,
                headers
            });
    
            // For requests that don't need JSON parsing (like logout)
            if (!parseJSON) {
                const formattedResponse = this.formatResponse(response.ok, null, 
                    response.ok ? 'Operation successful' : 'Operation failed');
                
                if (!formattedResponse.success && this.notificationCallback) {
                    this.notificationCallback(formattedResponse.message, formattedResponse.error);
                }
                
                return formattedResponse;
            }
    
            let responseData;
            try {
                responseData = await response.json();
            } catch (e) {
                const formattedResponse = response.ok 
                    ? this.formatResponse(true, null, 'Operation successful')
                    : this.formatResponse(false, null, 'Request failed', 'Invalid response format');
                
                if (!formattedResponse.success && this.notificationCallback) {
                    this.notificationCallback(formattedResponse.message, formattedResponse.error);
                }
                
                return formattedResponse;
            }
    
            // First check if there's an error message in the response
            if (!response.ok) {
                const errorMessage = responseData?.error || responseData?.message || 'Request failed';
                const formattedResponse = this.formatResponse(false, null, errorMessage, errorMessage);
                
                // If it's a 401 and we don't have a direct error message, try token refresh
                if (response.status === 401 && !responseData?.error && this.refreshToken) {
                    try {
                        await this.refreshAccessToken();
                        // Retry the original request with new token
                        return this.request(endpoint, options);
                    } catch (refreshError) {
                        this.clearTokens();
                    }
                }
                
                if (this.notificationCallback) {
                    this.notificationCallback(errorMessage, errorMessage);
                }
                
                return formattedResponse;
            }
    
            const formattedResponse = this.formatResponse(true, responseData, 
                responseData?.message || 'Operation successful');
            
            return formattedResponse;
    
        } catch (error) {
            const formattedResponse = this.formatResponse(false, null,
                'Request failed',
                error.message === 'Failed to fetch' ? 'Network error' : error.message);
            
            if (this.notificationCallback) {
                this.notificationCallback(formattedResponse.message, formattedResponse.error);
            }
            
            return formattedResponse;
        }
    }

    async refreshAccessToken() {
        try {
            const response = await fetch(`${this.baseURL}/accounts/token/refresh/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    refresh: this.refreshToken
                })
            });

            if (!response.ok) {
                throw new Error('Token refresh failed');
            }

            const data = await response.json();
            const accessToken = data.tokens?.access || data.access;
            const refreshToken = data.tokens?.refresh || data.refresh;
            
            this.setTokens(accessToken, refreshToken);
            return this.formatResponse(true, data, 'Token refresh successful');
        } catch (error) {
            this.clearTokens();
            throw error;
        }
    }

    setTokens(accessToken, refreshToken = null) {
        if (accessToken) {
            this.accessToken = accessToken;
            localStorage.setItem('accessToken', accessToken);
        }
        
        if (refreshToken) {
            this.refreshToken = refreshToken;
            localStorage.setItem('refreshToken', refreshToken);
        }
    }

    clearTokens() {
        this.accessToken = null;
        this.refreshToken = null;
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
    }

    accounts() {
        return new AccountsService(this);
    }
    Buckets(){
        return new BucketsService(this)
    }
    Items(){
        return new ItemService(this)
    }
    Versions(){
        return new VersionService(this)
    }
    Approvals(){
        return new ApprovalService(this)
    }
}

class AccountsService {
    constructor(baseService) {
        this.baseService = baseService;
        this.endpoint = '/accounts';
    }

    async login(email, password) {
        try {
            const response = await this.baseService.request(`${this.endpoint}/login/`, {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });
            
            if (response.success && response.data?.tokens) {
                
                this.baseService.setTokens(
                    response.data.tokens.access,
                    response.data.tokens.refresh
                );
                
                return this.baseService.formatResponse(
                    true,
                     response.data.user,
                    'Login successful'
                );
            }
            
            return response;
        } catch (error) {
            this.baseService.clearTokens();
            return this.baseService.formatResponse(
                false,
                null,
                'Login failed',
                error.message
            );
        }
    }

    async register(email, username, password, password_confirm, first_name, last_name) {
        try {
            const response = await this.baseService.request(`${this.endpoint}/register/`, {
                method: 'POST',
                body: JSON.stringify({ 
                    email, 
                    username, 
                    password,
                    password_confirm,
                    first_name,
                    last_name
                })
            });
            
            if (response.success && response.data?.tokens) {
                // this.baseService.setTokens(
                //     response.data.tokens.access,
                //     response.data.tokens.refresh
                // );
                
                return this.baseService.formatResponse(
                    true,
                    response.data?.user,
                    'Registration successful'
                );
            }
            
            return response;
        } catch (error) {
            this.baseService.clearTokens();
            return this.baseService.formatResponse(
                false,
                null,
                'Registration failed',
                error.message
            );
        }
    }

    async getProfile() {
        return this.baseService.request(`${this.endpoint}/profile/`);
    }
    
    async updateProfile(userData) {
        try {
            const response = await this.baseService.request(
                `${this.endpoint}/profile/`,
                {
                    method: 'PATCH',
                    body: JSON.stringify(userData)
                }
            );
            
            return response;
        } catch (error) {
            console.error('Update profile request failed:', error);
            return this.baseService.formatResponse(
                false,
                null,
                'Profile update failed',
                error.message
            );
        }
    }
    
    async deleteProfile() {
        try {
            const response = await this.baseService.request(
                `${this.endpoint}/profile/`,
                {
                    method: 'DELETE'
                }
            );
            
            return response;
        } catch (error) {
            console.error('Delete profile request failed:', error);
            return this.baseService.formatResponse(
                false,
                null,
                'Profile deletion failed',
                error.message
            );
        } finally {
            // Since this is account deletion, we should clear tokens like logout
            this.baseService.clearTokens();
        }
    }
    
    async logout() {
        try {
            const response = await this.baseService.request(
                `${this.endpoint}/logout/`,
                {
                    method: 'POST',
                    body: JSON.stringify({ refresh_token: this.baseService.refreshToken })
                },
                false
            );
            
            return response;
        } catch (error) {
            console.error('Logout request failed:', error);
            return this.baseService.formatResponse(
                false,
                null,
                'Logout failed',
                error.message
            );
        } finally {
            this.baseService.clearTokens();
        }
    }
    async serachUser({search}) {
        if(!search||search==""){
            return
        }
        const endpoint = `${this.endpoint}/search/${search}/`;
        return this.baseService.request(endpoint);
    }

    async changePassword(oldPassword, newPassword) {
        try {
            const response = await this.baseService.request(
                `${this.endpoint}/change-password/`,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        old_password: oldPassword,
                        new_password: newPassword
                    })
                }
            );
            
            return response;
        } catch (error) {
            console.error('Password change request failed:', error);
            return this.baseService.formatResponse(
                false,
                null,
                'Password change failed',
                error.message
            );
        }
    }
}

class ApprovalService {
    constructor(baseService) {
        this.baseService = baseService;
        this.endpoint = '/approval';
    
    }

    async getItemSetting ({itemID}) {

        if(!itemID){
            return
        }

        return this.baseService.request(
            `${this.endpoint}/${itemID}/ItemSetting`
        )

    }
    async getBucketSetting ({bucketId}) {

        if(!bucketId){
            return
        }

        return this.baseService.request(
            `${this.endpoint}/${bucketId}/BucketSetting`
        )

    }

    async UpdateItemSetting ({itemID,body}) {

        if(!itemID){
            return
        }

        return this.baseService.request(
            `${this.endpoint}/${itemID}/ItemSetting`,{
                method: 'PUT',
                body: JSON.stringify(body)
            }
        )

    }
    async UpdateBucketSetting ({bucketId,body}) {

        if(!bucketId){
            return
        }

        return this.baseService.request(
            `${this.endpoint}/${bucketId}/BucketSetting`,{
                method: 'PUT',
                body: JSON.stringify(body)
            }
        )

    }




}
class BucketsService {
    constructor(baseService) {
        this.baseService = baseService;
        this.endpoint = '/buckets';
    }
    async listAllBucket(){
        return this.baseService.request(
            `${this.endpoint}/listAllBucket/`
        )
    }
    async CreateBucket({BucketName,parentId=null}){
        return this.baseService.request(
            `${this.endpoint}/${BucketName}${parentId?"?parentId="+parentId:""}`,
            {
                method: 'PUT',
            }
            
        )

    }

    async shareBucket ({bucketId,email,permissionType}){
        if( !bucketId || !email || !permissionType){
            return
        }
        return this.baseService.request(
            `${this.endpoint}/${bucketId}/assignBucketPermission/${email}/${permissionType}`,{
                method:'PUT'
            }
        )
    }
    async removeBucketShare ({bucketId,email}){
        if (!bucketId ||!email){
            return 
        }
        return this.baseService.request(
            `${this.endpoint}/${bucketId}/revokeBucketPermission/${email}`,{
                method:'DELETE',
            }
        )
    }

    async listAllContent({bucketId}){
        return this.baseService.request(
            `${this.endpoint}${bucketId?"?bucketId="+bucketId:""}`
        )
    }
    async listAllContentbyExtension({extension}){
        
        return this.baseService.request(
            `${this.endpoint}/extension/${extension}`
        )
    }
    async getBucketShares ({bucketId}) {

        if(!bucketId){
            return
        }

        return this.baseService.request(
            `${this.endpoint}/${bucketId}/listuserAcessOfBucket`
        )

    }

    async listBucketApproval(){
        return this.baseService.request(
            `${this.endpoint}/Approvals`
        )

    }

    async removeBucket ({bucketId}){
        return this.baseService.request(
            `${this.endpoint}/${bucketId}/bucket`,{
                method:'DELETE',
            }
        )
    }


}

class ItemService{

    constructor(baseService) {
        this.baseService = baseService;
        this.endpoint = '/buckets';
    }
    async listAllObject({BucketName}){
        return this.baseService.request(
            `${this.endpoint}/listAllObject/${BucketName}`
        )
    }
   


    async uploadFileWithProgress({ notes, file, currentBucketID = null, onProgress = () => {} }) {
        return new Promise((resolve, reject) => {
            if (!file || !file.name) {
                const errorResponse = this.baseService.formatResponse(false, null, "File is required", "Invalid file");
                if (this.baseService.notificationCallback) {
                    this.baseService.notificationCallback(errorResponse.message, errorResponse.error);
                }
                return reject(errorResponse);
            }
    
            const fileName = encodeURIComponent(file.name); // Ensuring safe URL usage
            const bucket = currentBucketID || "Root";
    
            const formData = new FormData();
            formData.append("file", file);
            if (notes) {
                formData.append("notes", notes); // Append notes as additional data
            }
    
            const xhr = new XMLHttpRequest();
    
            // Track upload progress
            xhr.upload.addEventListener("progress", (event) => {
                if (event.lengthComputable) {
                    const progress = Math.round((event.loaded / event.total) * 100);
                    onProgress(progress);
                }
            });
    
            xhr.addEventListener("load", () => {
                try {
                    
                    const response = JSON.parse(xhr.response);
                    if (xhr.status === 200) {
                        const successResponse = this.baseService.formatResponse(true, response, 'Upload successful');
                        // if (this.baseService.notificationCallback) {
                        //     this.baseService.notificationCallback(successResponse.message, null);
                        // }
                        resolve(successResponse);
                    } else {
                        const errorResponse = this.baseService.formatResponse(false, null, 
                            response.error || "Upload failed", 
                            response.error || "Upload failed");
                        if (this.baseService.notificationCallback) {
                            this.baseService.notificationCallback(errorResponse.message, errorResponse.error);
                        }
                        reject(errorResponse);
                    }
                } catch (error) {
                    const errorResponse = this.baseService.formatResponse(false, null, "Upload failed", "Failed to parse response");
                    if (this.baseService.notificationCallback) {
                        this.baseService.notificationCallback(errorResponse.message, errorResponse.error);
                    }
                    reject(errorResponse);
                }
            });
    
            xhr.addEventListener("error", () => {
                let errorMessage = "Network error";  // Default message
                
                
                // Check if there's a response from the server to parse the error
                try {
                    const response = JSON.parse(xhr.response);
                    errorMessage = response.error || response.message || "Network error"; // Extract error message from response
                } catch (e) {
                    // If parsing fails, fall back to default error message
                }
            
                const errorResponse = this.baseService.formatResponse(false, null, "Upload failed", errorMessage);
                if (this.baseService.notificationCallback) {
                    this.baseService.notificationCallback(errorResponse.message, errorResponse.error);
                }
                reject(errorResponse);
            });
            
            xhr.addEventListener("abort", () => {
                let errorMessage = "Upload was cancelled";  // Default message
              
                // Check if there's a response from the server to parse the error
                try {
                    const response = JSON.parse(xhr.response);
                    errorMessage = response.error || response.message || "Upload was cancelled"; // Extract error message from response
                } catch (e) {
                    // If parsing fails, fall back to default error message
                }
            
                const errorResponse = this.baseService.formatResponse(false, null, "Upload cancelled", errorMessage);
                if (this.baseService.notificationCallback) {
                    this.baseService.notificationCallback(errorResponse.message, errorResponse.error);
                }
                reject(errorResponse);
            });
            
    
            // Open and send the request
            xhr.open(
                "PUT",
                `${this.baseService.baseURL}${this.endpoint}/${bucket}/objects/${fileName}`
            );
    
            // Add authorization header
            const authHeader = this.baseService.getAuthHeader();
            if (authHeader.Authorization) {
                xhr.setRequestHeader("Authorization", authHeader.Authorization);
            }
    
            xhr.send(formData);
        });
    }
    

    async shareItem ({itemID,email,permissionType}){
        if (!itemID ||!email){
            return 
        }
        return this.baseService.request(
            `${this.endpoint}/${itemID}/assignItemPermission/${email}/${permissionType}`,{
                method:'PUT',
            }
        )
    }
    async removeItemShare ({itemID,email}){
        if (!itemID ||!email){
            return 
        }
        return this.baseService.request(
            `${this.endpoint}/${itemID}/revokeItemPermission/${email}`,{
                method:'DELETE',
            }
        )
    }
    async getItemShares ({itemID}) {

        if(!itemID){
            return
        }

        return this.baseService.request(
            `${this.endpoint}/${itemID}/listuserAcessOfItem`
        )

    }
    async removeItem ({itemID,versionID=null}){
        return this.baseService.request(
            `${this.endpoint}/${itemID}/objects${versionID?"?versionId="+versionID:""}`,{
                method:'DELETE',
            }
        )
    }
}


class VersionService{
    constructor(baseService) {
        this.baseService = baseService;
        this.endpoint = '/versions';
    }

    async getExtractText ({versionID}) {

        if(!versionID){
            return
        }

        return this.baseService.request(
            `${this.endpoint}/extractText/${versionID}`
        )

    }

    async approveVersion ({versionID}){
        if (!versionID){
            return 
        }
        return this.baseService.request(
            `${this.endpoint}/${versionID}/approve`,{
                method:'PUT',
            }
        )
    }
    async rejectVersion ({versionID}){
        if (!versionID){
            return 
        }
        return this.baseService.request(
            `${this.endpoint}/${versionID}/reject`,{
                method:'PUT',
            }
        )
    }

    async getFileWithProgress({versionID, onProgress = () => {}}) {
        if(!versionID){
            return
        }
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.responseType = 'blob';  // Ensure the response is a Blob (for file download)
    
            xhr.addEventListener('progress', (event) => {
                if (event.lengthComputable) {
                    const progress = Math.round((event.loaded / event.total) * 100);
                    onProgress(progress);
                }
            });
    
            xhr.addEventListener('load', async () => {
                if (xhr.status === 200) {
                    const blob = xhr.response;
    
                    // Extract filename from Content-Disposition header if available
                    // const contentDisposition = xhr.getResponseHeader('Content-Disposition');
                    let fileName = `download-${versionID}.bin`;
                    // if (contentDisposition) {
                    //     const match = contentDisposition.match(/filename="(.+)"/);
                    //     if (match) {
                    //         fileName = match[1];
                    //     }
                    // }
    
                    resolve({
                        blob,
                        download: () => this.downloadBlob(blob, fileName),
                        getUrl: () => window.URL.createObjectURL(blob),
                    });
                } else {
                    let errorMessage = 'Download failed';
    
                    try {
                        const responseText = await xhr.response.text();
                        const responseJson = JSON.parse(responseText);
                        errorMessage = responseJson.error || responseJson.message || errorMessage;
                    } catch (e) {
                        // If JSON parsing fails, fallback to default error message
                    }
    
                    reject(this.baseService.formatResponse(false, null, errorMessage, 'Download failed'));
                }
            });
    
            xhr.addEventListener('error', () => {
                reject(this.baseService.formatResponse(false, null, 'Download failed due to network error', 'Network error'));
            });
    
            const url = `${this.baseService.baseURL}${this.endpoint}/download/${versionID}`;
    
            xhr.open('GET', url);
            xhr.setRequestHeader('Accept', 'application/octet-stream'); // Indicate file download
            
            // Add authorization header only for internal URLs
            const authHeader = this.baseService.getAuthHeader();
            if (authHeader.Authorization) {
                xhr.setRequestHeader('Authorization', authHeader.Authorization);
            }
    
            xhr.send();
        });
    }
    

}



const api = new BaseService();
export default api;