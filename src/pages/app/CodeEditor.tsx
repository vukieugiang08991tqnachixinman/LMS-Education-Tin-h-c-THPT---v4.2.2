import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { Play, RotateCcw, Code2, Database, Globe, Loader2, Maximize2, Minimize2 } from 'lucide-react';
import { motion } from 'motion/react';
import { loadPyodide } from 'pyodide';
import initSqlJs from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

type Language = 'python' | 'sql' | 'web';

const DEFAULT_CODE = {
  python: `# Viết code Python của bạn ở đây\nprint("Xin chào từ Python!")\n\n# Ví dụ tính tổng 2 số\na = 5\nb = 10\nprint(f"Tổng của {a} và {b} là: {a + b}")`,
  sql: `-- Viết câu lệnh SQL của bạn ở đây\n-- Đã có sẵn bảng 'students' (id, name, score)\nSELECT * FROM students;`,
  web: `<!-- Viết mã HTML/CSS/JS của bạn ở đây -->\n<!DOCTYPE html>\n<html>\n<head>\n  <style>\n    body { font-family: sans-serif; text-align: center; margin-top: 50px; }\n    h1 { color: #4f46e5; }\n    button { padding: 10px 20px; background: #4f46e5; color: white; border: none; border-radius: 5px; cursor: pointer; }\n  </style>\n</head>\n<body>\n  <h1>Xin chào thế giới Web!</h1>\n  <button onclick="alert('Bạn đã click!')">Click thử xem</button>\n</body>\n</html>`
};

export const CodeEditor: React.FC = () => {
  const [language, setLanguage] = useState<Language>('python');
  const [code, setCode] = useState(DEFAULT_CODE.python);
  const [output, setOutput] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Pyodide & SQL.js instances
  const pyodideRef = useRef<any>(null);
  const sqlDbRef = useRef<any>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Load Pyodide
  useEffect(() => {
    const loadPyodideEnv = async () => {
      if (pyodideRef.current) return;
      try {
        pyodideRef.current = await loadPyodide({
          indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.29.3/full/',
          stdout: (text: string) => setOutput(prev => prev + text + '\n'),
          stderr: (text: string) => setOutput(prev => prev + text + '\n')
        });
      } catch (err) {
        console.error("Failed to load Pyodide", err);
      }
    };

    const loadSqlJsEnv = async () => {
      if (sqlDbRef.current) return;
      try {
        const SQL = await initSqlJs({
          locateFile: () => sqlWasmUrl
        });
        const db = new SQL.Database();
        // Seed some initial data
        db.run("CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT, score INTEGER);");
        db.run("INSERT INTO students VALUES (1, 'Nguyễn Văn A', 85);");
        db.run("INSERT INTO students VALUES (2, 'Trần Thị B', 92);");
        db.run("INSERT INTO students VALUES (3, 'Lê Văn C', 78);");
        sqlDbRef.current = db;
      } catch (err) {
        console.error("Failed to load SQL.js", err);
      }
    };

    loadPyodideEnv();
    loadSqlJsEnv();
  }, []);

  const handleLanguageChange = (newLang: Language) => {
    setLanguage(newLang);
    setCode(DEFAULT_CODE[newLang]);
    setOutput('');
    if (newLang === 'web') {
      // Need a slight delay to allow iframe to render
      setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.srcdoc = DEFAULT_CODE.web;
        }
      }, 100);
    }
  };

  const runCode = async () => {
    setIsRunning(true);
    setOutput('');

    try {
      if (language === 'python') {
        if (!pyodideRef.current) {
          setOutput('Đang tải môi trường Python... Vui lòng thử lại sau vài giây.');
          setIsRunning(false);
          return;
        }
        
        // Clear previous output
        setOutput('');
        
        // Run code
        try {
          await pyodideRef.current.runPythonAsync(code);
        } catch (e: any) {
          setOutput(prev => prev + '\nLỗi Python: ' + e.message);
        }
      } else if (language === 'sql') {
        if (!sqlDbRef.current) {
          setOutput('Đang tải môi trường SQL... Vui lòng thử lại sau vài giây.');
          setIsRunning(false);
          return;
        }
        
        try {
          const res = sqlDbRef.current.exec(code);
          if (res && res.length > 0) {
            let out = '';
            for (const r of res) {
              out += r.columns.join(' | ') + '\n';
              out += '-'.repeat(r.columns.join(' | ').length) + '\n';
              for (const val of r.values) {
                out += val.join(' | ') + '\n';
              }
              out += '\n';
            }
            setOutput(out);
          } else {
            setOutput('Thực thi thành công (không có dữ liệu trả về).');
          }
        } catch (e: any) {
          setOutput(`Lỗi SQL: ${e.message}`);
        }
      } else if (language === 'web') {
        if (iframeRef.current) {
          iframeRef.current.srcdoc = code;
        }
      }
    } catch (err: any) {
      setOutput(`Lỗi: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const resetCode = () => {
    setCode(DEFAULT_CODE[language]);
    setOutput('');
    if (language === 'web' && iframeRef.current) {
      iframeRef.current.srcdoc = DEFAULT_CODE.web;
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${isFullscreen ? 'fixed inset-0 z-[100] bg-gray-50 p-4' : 'p-4 sm:p-8 max-w-7xl mx-auto h-[calc(100vh-4rem)]'} flex flex-col gap-4`}
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
            <Code2 size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Trình biên dịch trực tuyến</h1>
            <p className="text-sm text-gray-500">Viết và chạy code trực tiếp trên trình duyệt</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => handleLanguageChange('python')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${language === 'python' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <Code2 size={16} /> Python
            </button>
            <button
              onClick={() => handleLanguageChange('web')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${language === 'web' ? 'bg-white text-rose-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <Globe size={16} /> Web (HTML/JS)
            </button>
            <button
              onClick={() => handleLanguageChange('sql')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${language === 'sql' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <Database size={16} /> SQL
            </button>
          </div>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
            title={isFullscreen ? "Thu nhỏ" : "Phóng to"}
          >
            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
        {/* Editor Panel */}
        <div className="flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
            <span className="text-sm font-semibold text-gray-700">Mã nguồn</span>
            <div className="flex items-center gap-2">
              <button
                onClick={resetCode}
                className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-md transition-colors"
                title="Khôi phục mã mặc định"
              >
                <RotateCcw size={16} />
              </button>
              <button
                onClick={runCode}
                disabled={isRunning}
                className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {isRunning ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                Chạy code
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-[300px]">
            <Editor
              height="100%"
              language={language === 'web' ? 'html' : language}
              theme="vs-light"
              value={code}
              onChange={(value) => setCode(value || '')}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                wordWrap: 'on',
                padding: { top: 16 },
                scrollBeyondLastLine: false,
              }}
            />
          </div>
        </div>

        {/* Output Panel */}
        <div className="flex flex-col bg-gray-900 rounded-2xl border border-gray-800 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900/50">
            <span className="text-sm font-semibold text-gray-300">Kết quả đầu ra</span>
          </div>
          <div className="flex-1 p-4 overflow-auto min-h-[300px] bg-[#1e1e1e]">
            {language === 'web' ? (
              <iframe
                ref={iframeRef}
                className="w-full h-full bg-white rounded-lg border-none"
                sandbox="allow-scripts"
                title="Web Preview"
              />
            ) : (
              <pre className="text-gray-300 font-mono text-sm whitespace-pre-wrap">
                {output || <span className="text-gray-600 italic">Nhấn "Chạy code" để xem kết quả...</span>}
              </pre>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
