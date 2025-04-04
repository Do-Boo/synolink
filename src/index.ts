#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { SynoClient } from "./syno-client.js";

// 환경 변수에서 설정 가져오기
const config = {
  host: process.env.SYNO_HOST || 'localhost',
  port: parseInt(process.env.SYNO_PORT || '5000'),
  username: process.env.SYNO_USER || '',
  password: process.env.SYNO_PASS || ''
};

// 시놀로지 클라이언트 초기화
const synoClient = new SynoClient(config.host, config.port);

// 스키마 정의
const LoginArgsSchema = z.object({
  username: z.string().describe('시놀로지 NAS 로그인 사용자명'),
  password: z.string().describe('시놀로지 NAS 로그인 비밀번호')
});

const LogoutArgsSchema = z.object({});

const ListFilesArgsSchema = z.object({
  path: z.string().describe('조회할 폴더 경로 (예: /volume1/photos)')
});

const ReadFileArgsSchema = z.object({
  path: z.string().describe('읽을 파일의 전체 경로')
});

const WriteFileArgsSchema = z.object({
  path: z.string().describe('파일을 저장할 전체 경로'),
  content: z.string().describe('파일에 저장할 내용')
});

const CreateFolderArgsSchema = z.object({
  path: z.string().describe('폴더를 생성할 상위 경로'),
  name: z.string().describe('생성할 폴더명')
});

const DeleteItemArgsSchema = z.object({
  path: z.string().describe('삭제할 파일이나 폴더의 전체 경로')
});

const MoveItemArgsSchema = z.object({
  source: z.string().describe('이동할 파일이나 폴더의 현재 경로'),
  destination: z.string().describe('이동할 대상 디렉토리 경로')
});

const GetFileInfoArgsSchema = z.object({
  path: z.string().describe('정보를 조회할 파일이나 폴더의 전체 경로')
});

const SearchFilesArgsSchema = z.object({
  path: z.string().describe('검색을 시작할 디렉토리 경로'),
  pattern: z.string().describe('검색할 파일 이름 패턴')
});

// 서버 설정
const server = new Server(
  {
    name: "synology-link-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 도구 목록 핸들러
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "login",
        description: "시놀로지 NAS에 로그인합니다. 다른 도구 사용 전에 먼저 로그인해야 합니다.",
        inputSchema: zodToJsonSchema(LoginArgsSchema),
      },
      {
        name: "logout",
        description: "시놀로지 NAS에서 로그아웃합니다.",
        inputSchema: zodToJsonSchema(LogoutArgsSchema),
      },
      {
        name: "list_files",
        description: "지정된 경로의 파일과 폴더를 나열합니다.",
        inputSchema: zodToJsonSchema(ListFilesArgsSchema),
      },
      {
        name: "read_file",
        description: "시놀로지 NAS에서 파일을 읽습니다.",
        inputSchema: zodToJsonSchema(ReadFileArgsSchema),
      },
      {
        name: "write_file",
        description: "시놀로지 NAS에 파일을 저장합니다.",
        inputSchema: zodToJsonSchema(WriteFileArgsSchema),
      },
      {
        name: "create_folder",
        description: "시놀로지 NAS에 새 폴더를 생성합니다.",
        inputSchema: zodToJsonSchema(CreateFolderArgsSchema),
      },
      {
        name: "delete_item",
        description: "시놀로지 NAS에서 파일이나 폴더를 삭제합니다.",
        inputSchema: zodToJsonSchema(DeleteItemArgsSchema),
      },
      {
        name: "move_item",
        description: "시놀로지 NAS에서 파일이나 폴더를 이동합니다.",
        inputSchema: zodToJsonSchema(MoveItemArgsSchema),
      },
      {
        name: "get_file_info",
        description: "시놀로지 NAS의 파일이나 폴더에 대한 상세 정보를 가져옵니다.",
        inputSchema: zodToJsonSchema(GetFileInfoArgsSchema),
      },
      {
        name: "search_files",
        description: "시놀로지 NAS에서 특정 패턴의 파일이나 폴더를 검색합니다.",
        inputSchema: zodToJsonSchema(SearchFilesArgsSchema),
      },
    ],
  };
});

// 도구 호출 핸들러
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    switch (name) {
      case "login": {
        const parsed = LoginArgsSchema.safeParse(args);
        if (!parsed.success) {
          throw new Error(`login 인자 오류: ${parsed.error}`);
        }
        
        const success = await synoClient.login(parsed.data.username, parsed.data.password);
        return {
          content: [{ 
            type: "text", 
            text: success ? "시놀로지 NAS에 성공적으로 로그인했습니다." : "시놀로지 NAS 로그인에 실패했습니다. 사용자명과 비밀번호를 확인하세요." 
          }],
        };
      }
      
      case "logout": {
        const success = await synoClient.logout();
        return {
          content: [{ 
            type: "text", 
            text: success ? "시놀로지 NAS에서 로그아웃했습니다." : "로그아웃 처리 중 오류가 발생했습니다." 
          }],
        };
      }
      
      case "list_files": {
        const parsed = ListFilesArgsSchema.safeParse(args);
        if (!parsed.success) {
          throw new Error(`list_files 인자 오류: ${parsed.error}`);
        }
        
        const result = await synoClient.listFiles(parsed.data.path);
        if (!result.success) {
          throw new Error(`파일 목록 가져오기 실패: ${result.error?.code}`);
        }
        
        const fileList = result.data.files.map((file: any) => {
          return {
            name: file.name,
            path: file.path,
            isDir: file.isdir,
            size: file.size,
            time: new Date(file.time.mtime * 1000).toISOString()
          };
        });
        
        return {
          content: [{ 
            type: "text", 
            text: `경로 "${parsed.data.path}"의 항목 목록:\n\n${JSON.stringify(fileList, null, 2)}` 
          }],
        };
      }
      
      case "read_file": {
        const parsed = ReadFileArgsSchema.safeParse(args);
        if (!parsed.success) {
          throw new Error(`read_file 인자 오류: ${parsed.error}`);
        }
        
        const content = await synoClient.readFile(parsed.data.path);
        return {
          content: [{ 
            type: "text", 
            text: content.toString('utf-8') 
          }],
        };
      }
      
      case "write_file": {
        const parsed = WriteFileArgsSchema.safeParse(args);
        if (!parsed.success) {
          throw new Error(`write_file 인자 오류: ${parsed.error}`);
        }
        
        // 경로에서 폴더와 파일명 분리
        const pathParts = parsed.data.path.split('/');
        const fileName = pathParts.pop() || '';
        const folderPath = pathParts.join('/') || '/';
        
        const success = await synoClient.writeFile(
          folderPath, 
          fileName, 
          Buffer.from(parsed.data.content, 'utf-8')
        );
        
        return {
          content: [{ 
            type: "text", 
            text: success ? `파일이 성공적으로 저장되었습니다: ${parsed.data.path}` : "파일 저장에 실패했습니다." 
          }],
        };
      }
      
      case "create_folder": {
        const parsed = CreateFolderArgsSchema.safeParse(args);
        if (!parsed.success) {
          throw new Error(`create_folder 인자 오류: ${parsed.error}`);
        }
        
        const success = await synoClient.createFolder(parsed.data.path, parsed.data.name);
        return {
          content: [{ 
            type: "text", 
            text: success ? `폴더가 성공적으로 생성되었습니다: ${parsed.data.path}/${parsed.data.name}` : "폴더 생성에 실패했습니다." 
          }],
        };
      }
      
      case "delete_item": {
        const parsed = DeleteItemArgsSchema.safeParse(args);
        if (!parsed.success) {
          throw new Error(`delete_item 인자 오류: ${parsed.error}`);
        }
        
        const success = await synoClient.deleteItem(parsed.data.path);
        return {
          content: [{ 
            type: "text", 
            text: success ? `항목이 성공적으로 삭제되었습니다: ${parsed.data.path}` : "항목 삭제에 실패했습니다." 
          }],
        };
      }
      
      case "move_item": {
        const parsed = MoveItemArgsSchema.safeParse(args);
        if (!parsed.success) {
          throw new Error(`move_item 인자 오류: ${parsed.error}`);
        }
        
        const success = await synoClient.moveItem(parsed.data.source, parsed.data.destination);
        return {
          content: [{ 
            type: "text", 
            text: success ? `항목이 성공적으로 이동되었습니다: ${parsed.data.source} -> ${parsed.data.destination}` : "항목 이동에 실패했습니다." 
          }],
        };
      }
      
      case "get_file_info": {
        const parsed = GetFileInfoArgsSchema.safeParse(args);
        if (!parsed.success) {
          throw new Error(`get_file_info 인자 오류: ${parsed.error}`);
        }
        
        const info = await synoClient.getFileInfo(parsed.data.path);
        return {
          content: [{ 
            type: "text", 
            text: `파일 정보:\n\n${JSON.stringify(info, null, 2)}` 
          }],
        };
      }
      
      case "search_files": {
        const parsed = SearchFilesArgsSchema.safeParse(args);
        if (!parsed.success) {
          throw new Error(`search_files 인자 오류: ${parsed.error}`);
        }
        
        const results = await synoClient.searchFiles(parsed.data.path, parsed.data.pattern);
        return {
          content: [{ 
            type: "text", 
            text: `검색 결과:\n\n${JSON.stringify(results, null, 2)}` 
          }],
        };
      }
      
      default:
        throw new Error(`알 수 없는 도구: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `오류: ${errorMessage}` }],
      isError: true,
    };
  }
});

// 서버 시작
async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("SynoLink MCP 서버가 stdio에서 실행 중입니다");
  console.error(`시놀로지 서버: ${config.host}:${config.port}`);
}

runServer().catch((error) => {
  console.error("서버 실행 중 치명적 오류:", error);
  process.exit(1);
});
