import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs/promises';

export class SynoClient {
  private baseUrl: string;
  private sid: string | null = null;
  
  constructor(host: string, port: number) {
    this.baseUrl = `http://${host}:${port}/webapi`;
  }
  
  async login(username: string, password: string): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/auth.cgi`, {
        params: {
          api: 'SYNO.API.Auth',
          version: '3',
          method: 'login',
          account: username,
          passwd: password,
          session: 'FileStation',
          format: 'sid'
        }
      });
      
      if (response.data.success) {
        this.sid = response.data.data.sid;
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  }
  
  async logout(): Promise<boolean> {
    if (!this.sid) return true;
    
    try {
      const response = await axios.get(`${this.baseUrl}/auth.cgi`, {
        params: {
          api: 'SYNO.API.Auth',
          version: '3',
          method: 'logout',
          session: 'FileStation',
          _sid: this.sid
        }
      });
      
      if (response.data.success) {
        this.sid = null;
        return true;
      }
      return false;
    } catch (error) {
      console.error('Logout failed:', error);
      return false;
    }
  }
  
  async listFiles(folderPath: string): Promise<any> {
    if (!this.sid) throw new Error('Not authenticated');
    
    try {
      const response = await axios.get(`${this.baseUrl}/entry.cgi`, {
        params: {
          api: 'SYNO.FileStation.List',
          version: '2',
          method: 'list',
          folder_path: folderPath,
          _sid: this.sid
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Failed to list files:', error);
      throw error;
    }
  }
  
  async readFile(filePath: string): Promise<Buffer> {
    if (!this.sid) throw new Error('Not authenticated');
    
    try {
      // FileStation API를 사용하여 파일 다운로드
      const response = await axios.get(`${this.baseUrl}/entry.cgi`, {
        params: {
          api: 'SYNO.FileStation.Download',
          version: '2',
          method: 'download',
          path: filePath,
          _sid: this.sid
        },
        responseType: 'arraybuffer'
      });
      
      return Buffer.from(response.data);
    } catch (error) {
      console.error('Failed to read file:', error);
      throw error;
    }
  }
  
  async writeFile(folderPath: string, fileName: string, content: Buffer): Promise<boolean> {
    if (!this.sid) throw new Error('Not authenticated');
    
    try {
      // 임시 파일로 저장
      const tempFilePath = `/tmp/${fileName}`;
      await fs.writeFile(tempFilePath, content);
      
      // FormData를 사용하여 파일 업로드
      const formData = new FormData();
      formData.append('api', 'SYNO.FileStation.Upload');
      formData.append('version', '2');
      formData.append('method', 'upload');
      formData.append('path', folderPath);
      formData.append('create_parents', 'true');
      formData.append('overwrite', 'true');
      formData.append('_sid', this.sid);
      formData.append('file', await fs.readFile(tempFilePath), fileName);
      
      const response = await axios.post(`${this.baseUrl}/entry.cgi`, formData, {
        headers: formData.getHeaders()
      });
      
      // 임시 파일 삭제
      await fs.unlink(tempFilePath);
      
      return response.data.success;
    } catch (error) {
      console.error('Failed to write file:', error);
      throw error;
    }
  }
  
  async createFolder(folderPath: string, name: string): Promise<boolean> {
    if (!this.sid) throw new Error('Not authenticated');
    
    try {
      const response = await axios.get(`${this.baseUrl}/entry.cgi`, {
        params: {
          api: 'SYNO.FileStation.CreateFolder',
          version: '2',
          method: 'create',
          folder_path: folderPath,
          name: name,
          _sid: this.sid
        }
      });
      
      return response.data.success;
    } catch (error) {
      console.error('Failed to create folder:', error);
      throw error;
    }
  }
  
  async deleteItem(path: string): Promise<boolean> {
    if (!this.sid) throw new Error('Not authenticated');
    
    try {
      const response = await axios.get(`${this.baseUrl}/entry.cgi`, {
        params: {
          api: 'SYNO.FileStation.Delete',
          version: '2',
          method: 'delete',
          path: JSON.stringify([path]),
          _sid: this.sid
        }
      });
      
      return response.data.success;
    } catch (error) {
      console.error('Failed to delete item:', error);
      throw error;
    }
  }
  
  async moveItem(source: string, destination: string): Promise<boolean> {
    if (!this.sid) throw new Error('Not authenticated');
    
    try {
      const response = await axios.get(`${this.baseUrl}/entry.cgi`, {
        params: {
          api: 'SYNO.FileStation.CreateFolder',
          version: '3',
          method: 'move',
          path: JSON.stringify([source]),
          dest_folder_path: destination,
          _sid: this.sid
        }
      });
      
      return response.data.success;
    } catch (error) {
      console.error('Failed to move item:', error);
      throw error;
    }
  }
  
  async getFileInfo(filePath: string): Promise<any> {
    if (!this.sid) throw new Error('Not authenticated');
    
    try {
      const response = await axios.get(`${this.baseUrl}/entry.cgi`, {
        params: {
          api: 'SYNO.FileStation.Info',
          version: '2',
          method: 'get',
          path: filePath,
          additional: JSON.stringify(["size", "time", "owner", "perm"]),
          _sid: this.sid
        }
      });
      
      return response.data.data;
    } catch (error) {
      console.error('Failed to get file info:', error);
      throw error;
    }
  }
  
  async searchFiles(folderPath: string, pattern: string): Promise<any> {
    if (!this.sid) throw new Error('Not authenticated');
    
    try {
      // 검색 작업 시작
      const startResponse = await axios.get(`${this.baseUrl}/entry.cgi`, {
        params: {
          api: 'SYNO.FileStation.Search',
          version: '2',
          method: 'start',
          folder_path: folderPath,
          pattern: pattern,
          _sid: this.sid
        }
      });
      
      if (!startResponse.data.success) {
        throw new Error('Failed to start search task');
      }
      
      const taskId = startResponse.data.data.taskid;
      
      // 검색 결과 가져오기
      let searchFinished = false;
      let searchResults: any[] = [];
      
      while (!searchFinished) {
        await new Promise(resolve => setTimeout(resolve, 500)); // 0.5초 대기
        
        const statusResponse = await axios.get(`${this.baseUrl}/entry.cgi`, {
          params: {
            api: 'SYNO.FileStation.Search',
            version: '2',
            method: 'list',
            taskid: taskId,
            _sid: this.sid
          }
        });
        
        if (statusResponse.data.data.files) {
          searchResults = searchResults.concat(statusResponse.data.data.files);
        }
        
        searchFinished = statusResponse.data.data.finished;
      }
      
      // 검색 작업 정리
      await axios.get(`${this.baseUrl}/entry.cgi`, {
        params: {
          api: 'SYNO.FileStation.Search',
          version: '2',
          method: 'stop',
          taskid: taskId,
          _sid: this.sid
        }
      });
      
      return searchResults;
    } catch (error) {
      console.error('Failed to search files:', error);
      throw error;
    }
  }
}
