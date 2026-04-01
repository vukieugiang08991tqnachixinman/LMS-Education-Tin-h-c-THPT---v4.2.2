import React, { useState, useEffect } from 'react';
import { Test, Submission, User, Class } from '../../core/types';
import { Modal } from '../../components/Modal';
import { Sparkles, Upload, Loader2, Save, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';
import { dataProvider } from '../../core/provider';
import { parseTruncatedJSON } from '../../utils/jsonUtils';

interface SubmissionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  test: Test;
  submission: (Submission & { student?: User, class?: Class }) | null;
  onSaved: () => void;
}

export const SubmissionDetailModal: React.FC<SubmissionDetailModalProps> = ({
  isOpen,
  onClose,
  test,
  submission,
  onSaved
}) => {
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [scores, setScores] = useState<Record<string, number>>({});
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({});
  const [isAIGrading, setIsAIGrading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedFileBase64, setUploadedFileBase64] = useState<string | null>(null);

  useEffect(() => {
    if (submission) {
      let parsedAnswers = {};
      try {
        parsedAnswers = submission.content 
          ? (typeof submission.content === 'string' ? JSON.parse(submission.content) : submission.content) 
          : {};
      } catch (e) {
        console.error("Error parsing submission content:", e);
      }
      setAnswers(parsedAnswers);
      
      const initialScores: Record<string, number> = {};
      const initialFeedbacks: Record<string, string> = {};
      
      test.questions.forEach(q => {
        if (parsedAnswers[`${q.id}_score`] !== undefined) {
          initialScores[q.id] = parsedAnswers[`${q.id}_score`];
        } else {
          // Calculate auto-grade for MC and TF if not present
          if (q.type === 'multiple_choice') {
            initialScores[q.id] = parsedAnswers[q.id] === q.correctAnswer ? q.points : 0;
          } else if (q.type === 'true_false' && q.subQuestions) {
            let correctCount = 0;
            const studentAns = parsedAnswers[q.id] || {};
            q.subQuestions.forEach(sq => {
              if (studentAns[sq.id] === sq.correctAnswer) correctCount++;
            });
            let scoreRatio = 0;
            if (correctCount === 1) scoreRatio = 0.1;
            else if (correctCount === 2) scoreRatio = 0.25;
            else if (correctCount === 3) scoreRatio = 0.5;
            else if (correctCount === 4) scoreRatio = 1.0;
            initialScores[q.id] = scoreRatio * q.points;
          }
        }
        
        if (parsedAnswers[`${q.id}_feedback`] !== undefined) {
          initialFeedbacks[q.id] = parsedAnswers[`${q.id}_feedback`];
        }
      });
      
      setScores(initialScores);
      setFeedbacks(initialFeedbacks);
      setUploadedFile(null);
      setUploadedFileBase64(submission.fileUrl || null);
    }
  }, [submission, test]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedFileBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAIGrade = async () => {
    if (!submission) return;
    setIsAIGrading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      let prompt = `Bạn là một giáo viên chấm bài thi. Hãy chấm điểm bài làm của học sinh dựa trên câu hỏi và đáp án/hướng dẫn chấm.
      
      Danh sách các câu hỏi và đáp án:
      ${test.questions.map((q, idx) => `
      Câu ${idx + 1}:
      - ID: ${q.id}
      - Loại: ${q.type}
      - Nội dung câu hỏi: ${q.content}
      - Đáp án/Hướng dẫn chấm: ${q.correctAnswer || (q.subQuestions ? JSON.stringify(q.subQuestions.map(sq => ({ id: sq.id, answer: sq.correctAnswer }))) : 'Không có')}
      - Điểm tối đa: ${q.points}
      ${!uploadedFileBase64 ? `- Câu trả lời của học sinh: ${JSON.stringify(answers[q.id] || 'Không trả lời')}` : ''}
      `).join('\n')}
      
      Trả về mảng JSON chứa kết quả chấm điểm cho từng câu. Mỗi phần tử gồm:
      - id: ID của câu hỏi
      - score: Điểm số đạt được (từ 0 đến điểm tối đa, có thể cho điểm lẻ như 0.25, 0.5)
      - feedback: Nhận xét chi tiết về câu trả lời của học sinh (chỉ ra lỗi sai nếu có, hoặc khen ngợi nếu làm tốt).
      `;

      let contents: any = prompt;

      if (uploadedFileBase64) {
        prompt += `\n\nHọc sinh đã nộp bài làm dưới dạng file đính kèm. Hãy đọc file đính kèm để trích xuất câu trả lời của học sinh và chấm điểm dựa trên đó. Nếu file là ảnh chụp bài làm tự luận, hãy đọc chữ viết tay và chấm điểm.`;
        
        const base64Data = uploadedFileBase64.split(',')[1];
        const mimeType = uploadedFileBase64.split(';')[0].split(':')[1];
        
        contents = {
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType
              }
            }
          ]
        };
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-preview",
        contents: contents,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                score: { type: Type.NUMBER },
                feedback: { type: Type.STRING }
              },
              required: ["id", "score", "feedback"]
            }
          }
        }
      });

      const gradingResults = parseTruncatedJSON(response.text);
      
      const newScores = { ...scores };
      const newFeedbacks = { ...feedbacks };
      
      gradingResults.forEach((result: any) => {
        newScores[result.id] = result.score;
        newFeedbacks[result.id] = result.feedback;
      });
      
      setScores(newScores);
      setFeedbacks(newFeedbacks);
      
    } catch (error) {
      console.error("Error grading with AI:", error);
      alert("Có lỗi xảy ra khi chấm bài bằng AI. Vui lòng thử lại.");
    } finally {
      setIsAIGrading(false);
    }
  };

  const handleSave = async () => {
    if (!submission) return;
    setIsSaving(true);
    
    try {
      let totalScore = 0;
      let maxScore = 0;
      
      const newAnswers = { ...answers };
      
      test.questions.forEach(q => {
        maxScore += q.points;
        const qScore = scores[q.id] || 0;
        totalScore += qScore;
        
        newAnswers[`${q.id}_score`] = qScore;
        if (feedbacks[q.id]) {
          newAnswers[`${q.id}_feedback`] = feedbacks[q.id];
        }
      });
      
      const finalScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 10 * 10) / 10 : 0;
      
      const payload: Partial<Submission> = {
        score: finalScore,
        content: JSON.stringify(newAnswers),
        feedback: "Đã chấm điểm"
      };
      
      if (uploadedFileBase64) {
        payload.fileUrl = uploadedFileBase64;
      }
      
      await dataProvider.update('submissions', submission.id, payload);
      onSaved();
      onClose();
    } catch (error) {
      console.error("Error saving grades:", error);
      alert("Có lỗi xảy ra khi lưu điểm.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!submission) return null;

  const totalCurrentScore = test.questions.reduce((sum, q) => sum + (scores[q.id] || 0), 0);
  const maxTotalScore = test.questions.reduce((sum, q) => sum + q.points, 0);
  const finalScore10 = maxTotalScore > 0 ? Math.round((totalCurrentScore / maxTotalScore) * 10 * 10) / 10 : 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Chi tiết bài làm - ${submission.student?.name || 'Học sinh'}`}>
      <div className="space-y-6 max-h-[80vh] overflow-y-auto p-1">
        
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-gray-50 p-4 rounded-xl border border-gray-200">
          <div>
            <p className="text-sm text-gray-500">Lớp: <span className="font-medium text-gray-900">{submission.class?.name || 'N/A'}</span></p>
            <p className="text-sm text-gray-500">Thời gian nộp: <span className="font-medium text-gray-900">{new Date(submission.submittedAt).toLocaleString('vi-VN')}</span></p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Điểm số</p>
              <p className="text-3xl font-black text-indigo-600">{finalScore10} <span className="text-lg text-gray-400">/ 10</span></p>
            </div>
            <button
              onClick={handleAIGrade}
              disabled={isAIGrading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              {isAIGrading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              Chấm bằng AI
            </button>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="font-bold text-gray-900 mb-3">File bài làm (Tùy chọn)</h3>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl cursor-pointer transition-colors">
              <Upload size={18} />
              <span>Tải lên file (Ảnh/PDF)</span>
              <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileChange} />
            </label>
            {uploadedFile && <span className="text-sm text-emerald-600 font-medium flex items-center gap-1"><CheckCircle size={16}/> Đã chọn: {uploadedFile.name}</span>}
            {!uploadedFile && uploadedFileBase64 && <span className="text-sm text-emerald-600 font-medium flex items-center gap-1"><CheckCircle size={16}/> Đã có file đính kèm</span>}
          </div>
          {uploadedFileBase64 && uploadedFileBase64.startsWith('data:image') && (
            <div className="mt-4 border rounded-lg overflow-hidden max-h-64 flex justify-center bg-gray-50">
              <img src={uploadedFileBase64} alt="Bài làm" className="max-h-64 object-contain" />
            </div>
          )}
          <p className="text-xs text-gray-500 mt-2">Nếu học sinh làm bài trên giấy, bạn có thể chụp ảnh và tải lên đây để AI đọc và chấm điểm.</p>
        </div>

        <div className="space-y-6">
          <h3 className="font-bold text-xl text-gray-900 border-b pb-2">Chi tiết các câu hỏi</h3>
          
          {test.questions.map((q, idx) => {
            const studentAnswer = answers[q.id];
            
            return (
              <div key={q.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-sm font-bold text-indigo-600 uppercase tracking-wider block mb-1">
                      Câu {idx + 1} - {q.type === 'multiple_choice' ? 'Trắc nghiệm' : q.type === 'true_false' ? 'Đúng/Sai' : q.type === 'short_answer' ? 'Trả lời ngắn' : 'Tự luận'}
                    </span>
                    <h4 className="font-medium text-gray-900">{q.content}</h4>
                  </div>
                  <div className="shrink-0 ml-4 flex items-center gap-2">
                    <input 
                      type="number" 
                      min="0" 
                      max={q.points} 
                      step="0.25"
                      value={scores[q.id] !== undefined ? scores[q.id] : ''}
                      onChange={(e) => setScores({...scores, [q.id]: parseFloat(e.target.value) || 0})}
                      className="w-20 px-2 py-1 border border-gray-300 rounded-lg text-center font-bold text-indigo-600 focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-gray-500">/ {q.points} đ</span>
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  {q.type === 'true_false' && q.subQuestions ? (
                    <div className="space-y-2 bg-gray-50 p-3 rounded-lg">
                      {q.subQuestions.map(sq => {
                        const sAns = (studentAnswer || {})[sq.id];
                        return (
                          <div key={sq.id} className="flex justify-between items-center">
                            <span><span className="font-medium">{sq.id})</span> {sq.content}</span>
                            <div className="flex gap-4">
                              <span className="text-gray-500">HS chọn: <span className={sAns === sq.correctAnswer ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>{sAns !== undefined ? (sAns ? 'Đúng' : 'Sai') : 'Trống'}</span></span>
                              <span className="text-gray-500">Đáp án: <span className="font-bold text-gray-900">{sq.correctAnswer ? 'Đúng' : 'Sai'}</span></span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                      <div>
                        <span className="text-gray-500 block mb-1">Câu trả lời của học sinh:</span>
                        <p className="font-medium text-gray-900 whitespace-pre-wrap">{studentAnswer !== undefined && studentAnswer !== '' ? studentAnswer : <span className="italic text-gray-400">Không có câu trả lời (hoặc xem trong file đính kèm)</span>}</p>
                      </div>
                      {q.correctAnswer && (
                        <div className="pt-2 border-t border-gray-200">
                          <span className="text-gray-500 block mb-1">Đáp án / Hướng dẫn chấm:</span>
                          <p className="font-medium text-emerald-700 whitespace-pre-wrap">{String(q.correctAnswer)}</p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nhận xét của giáo viên (hoặc AI):</label>
                    <textarea 
                      value={feedbacks[q.id] || ''}
                      onChange={(e) => setFeedbacks({...feedbacks, [q.id]: e.target.value})}
                      placeholder="Nhập nhận xét cho câu hỏi này..."
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="sticky bottom-0 bg-white pt-4 pb-2 border-t border-gray-100 flex justify-end gap-3 mt-6">
          <button 
            onClick={onClose}
            className="px-6 py-2 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors font-medium"
          >
            Đóng
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2 text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors font-bold disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Lưu điểm
          </button>
        </div>
      </div>
    </Modal>
  );
};
