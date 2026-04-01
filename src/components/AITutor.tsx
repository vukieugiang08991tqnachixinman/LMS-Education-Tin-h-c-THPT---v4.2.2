import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Sparkles, MessageSquare, Minimize2, Maximize2, User, GraduationCap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AITutorProps {
  lessonTitle: string;
  lessonContent: string;
  interactiveContent?: any[];
  userName?: string;
}

export const AITutor: React.FC<AITutorProps> = ({ lessonTitle, lessonContent, interactiveContent, userName }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Chào ${userName || 'bạn'}! Mình là Trợ lý học tập AI. Mình đã nắm rõ nội dung bài học "${lessonTitle}". Bạn có thắc mắc gì về bài học này không?`
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const interactiveSummary = interactiveContent ? 
        interactiveContent.map(block => {
          if (block.type === 'interactive_question' && block.data.interactiveQuestion) {
            const q = block.data.interactiveQuestion;
            return `[Câu hỏi tương tác]: ${q.question} (Loại: ${q.type}, Đáp án: ${q.correctAnswer})`;
          }
          return `[Khối ${block.type}]: ${block.data.content || ''}`;
        }).join('\n') : '';

      const systemInstruction = `Bạn là một trợ lý học tập (AI Tutor) chuyên nghiệp, thân thiện và kiên nhẫn cho học sinh THPT.
Nhiệm vụ của bạn là giúp học sinh hiểu rõ bài học "${lessonTitle}".
Dưới đây là nội dung bài học để bạn tham khảo:
---
${lessonContent}

Nội dung tương tác (quizzes, câu hỏi):
${interactiveSummary}
---
Quy tắc:
1. Luôn trả lời bằng tiếng Việt.
2. Giải thích ngắn gọn, dễ hiểu, phù hợp với trình độ học sinh lớp 10-12.
3. Nếu học sinh hỏi ngoài lề bài học, hãy khéo léo dẫn dắt họ quay lại nội dung bài học.
4. Khuyến khích học sinh tự suy nghĩ thay vì đưa ngay đáp án cuối cùng. Nếu học sinh hỏi đáp án câu hỏi tương tác, hãy gợi ý cách làm thay vì cho ngay đáp án.
5. Sử dụng các ví dụ thực tế liên quan đến Tin học.`;

      const chat = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: systemInstruction,
        },
        history: messages.map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }]
        }))
      });

      const response = await chat.sendMessage({ message: userMessage });
      const aiResponse = response.text || "Xin lỗi, mình gặp chút trục trặc khi suy nghĩ. Bạn thử hỏi lại nhé!";
      
      setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
    } catch (error) {
      console.error("AI Tutor Error:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Rất tiếc, mình đang mất kết nối với máy chủ AI. Vui lòng thử lại sau nhé!" }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ 
              opacity: 1, 
              scale: 1, 
              y: 0,
              height: isMinimized ? '60px' : '500px',
              width: '350px'
            }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white rounded-2xl shadow-2xl border border-indigo-100 overflow-hidden mb-4 flex flex-col"
          >
            {/* Header */}
            <div className="bg-indigo-600 p-4 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-white/20 rounded-lg">
                  <Bot size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-sm">AI Tutor</h3>
                  <p className="text-[10px] text-indigo-100 opacity-80">Đang trực tuyến</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                >
                  {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
                </button>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {!isMinimized && (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-indigo-50/30">
                  {messages.map((msg, idx) => (
                    <div 
                      key={idx} 
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                          msg.role === 'user' ? 'bg-indigo-100 text-indigo-600' : 'bg-indigo-600 text-white'
                        }`}>
                          {msg.role === 'user' ? <User size={16} /> : <GraduationCap size={16} />}
                        </div>
                        <div className={`p-3 rounded-2xl text-sm shadow-sm ${
                          msg.role === 'user' 
                            ? 'bg-indigo-600 text-white rounded-tr-none' 
                            : 'bg-white text-gray-800 rounded-tl-none border border-indigo-50'
                        }`}>
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="flex gap-2 max-w-[85%]">
                        <div className="shrink-0 w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                          <GraduationCap size={16} />
                        </div>
                        <div className="p-3 rounded-2xl bg-white text-gray-800 rounded-tl-none border border-indigo-50 shadow-sm flex items-center gap-1">
                          <motion.div 
                            animate={{ scale: [1, 1.2, 1] }} 
                            transition={{ repeat: Infinity, duration: 1 }}
                            className="w-1.5 h-1.5 bg-indigo-400 rounded-full" 
                          />
                          <motion.div 
                            animate={{ scale: [1, 1.2, 1] }} 
                            transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                            className="w-1.5 h-1.5 bg-indigo-400 rounded-full" 
                          />
                          <motion.div 
                            animate={{ scale: [1, 1.2, 1] }} 
                            transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                            className="w-1.5 h-1.5 bg-indigo-400 rounded-full" 
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 bg-white border-t border-indigo-50 shrink-0">
                  <div className="relative">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                      placeholder="Hỏi mình về bài học này..."
                      className="w-full pl-4 pr-12 py-3 bg-indigo-50/50 border border-indigo-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                    />
                    <button
                      onClick={handleSend}
                      disabled={!input.trim() || isLoading}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`p-4 rounded-full shadow-xl flex items-center justify-center transition-all ${
          isOpen ? 'bg-white text-indigo-600 border border-indigo-100' : 'bg-indigo-600 text-white'
        }`}
      >
        {isOpen ? <X size={24} /> : (
          <div className="relative">
            <Bot size={24} />
            <motion.div 
              animate={{ opacity: [0, 1, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute -top-1 -right-1"
            >
              <Sparkles size={12} className="text-yellow-300 fill-yellow-300" />
            </motion.div>
          </div>
        )}
      </motion.button>
    </div>
  );
};
