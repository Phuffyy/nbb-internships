import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'
import { supabase } from './supabaseClient'; 
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  ExternalLink, 
  MapPin, 
  Phone, 
  TrendingUp, 
  Filter, 
  Star,
  Search,
  ChevronDown,
  ChevronUp,
  Info,
  Camera,
  Loader2,
  Image as ImageIcon
} from 'lucide-react';

function App() {
  const [internships, setInternships] = useState([]);
  const [userLocation, setUserLocation] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ทั้งหมด');
  const [sortBy, setSortBy] = useState('score');
  const [isProcessing, setIsProcessing] = useState(false);

 // ดึงค่าจาก Environment Variable (Vite จะเป็นคนหามาให้ตอนรัน)
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    department: '',
    contact: '',
    locationName: '',
    googleMapsUrl: '',
    distance: 0,
    travelTime: 0,
    travelCost: 0,
    status: 'รอการติดต่อ',
    remuneration: 0,
    personalPreference: 5,
  });

useEffect(() => {
    fetchInternships();
  }, []);

  const fetchInternships = async () => {
    const { data, error } = await supabase
      .from('internships') // ชื่อตาราง
      .select('*')
      .order('id', { ascending: true }); // เรียงลำดับตาม id

    if (error) {
      console.error('Error fetching data:', error);
    } else if (data) {
      setInternships(data); // เอาข้อมูลที่ดึงมาใส่ใน List หน้าเว็บ
    }
  };
  // --------------------------------------------------------
  // Function to call Gemini AI for image understanding
  const processImageWithAI = async (base64Image) => {
    setIsProcessing(true);
    const prompt = `Analyze this internship recruitment post/image and extract details. 
    Return ONLY a JSON object with these keys (use Thai for text fields if appropriate): 
    { "name": "company name", "department": "position/dept", "contact": "phone/email/line", "locationName": "place name", "remuneration": number (daily rate in Baht, estimate if monthly), "distance": number (km), "travelTime": number (min) }. 
    If info is missing, use null or 0. Focus on accuracy.`;

    const payload = {
      contents: [{
        role: "user",
        parts: [
          { text: prompt },
          { inlineData: { mimeType: "image/png", data: base64Image.split(',')[1] } }
        ]
      }]
    };

    const fetchWithRetry = async (url, options, retries = 5, backoff = 1000) => {
      try {
        const response = await fetch(url, options);
        if (!response.ok) throw new Error('API Error');
        return await response.json();
      } catch (err) {
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, backoff));
          return fetchWithRetry(url, options, retries - 1, backoff * 2);
        }
        throw err;
      }
    };

    try {
      const result = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );

      const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
      const jsonStr = textResponse.match(/\{[\s\S]*\}/)?.[0];
      if (jsonStr) {
        const extractedData = JSON.parse(jsonStr);
        setFormData(prev => ({
          ...prev,
          name: extractedData.name || prev.name,
          department: extractedData.department || prev.department,
          contact: extractedData.contact || prev.contact,
          locationName: extractedData.locationName || prev.locationName,
          remuneration: extractedData.remuneration || prev.remuneration,
          distance: extractedData.distance || prev.distance,
          travelTime: extractedData.travelTime || prev.travelTime
        }));
      }
    } catch (error) {
      console.error("AI Error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        processImageWithAI(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const calculateScores = (item) => {
    const distanceScore = Math.max(0, 10 - (item.distance / 3));
    const costScore = Math.max(0, 10 - (item.travelCost / 20));
    const payScore = Math.min(10, (item.remuneration / 50));
    const preferenceScore = item.personalPreference;
    const total = (distanceScore * 2) + (costScore * 2) + (payScore * 3) + (preferenceScore * 3);
    return parseFloat((total).toFixed(2));
  };

  const handleAddInternship = async (e) => {
    e.preventDefault();
    
    // คำนวณคะแนนและเตรียมข้อมูล
    const newScore = calculateScores(formData);
    const newEntry = {
      ...formData,
      score: newScore
      // สังเกตว่าเราลบ id: Date.now() ออกไป เพราะ Supabase จะสร้าง id ให้เราเอง
    };

    // ส่งข้อมูลบันทึกลง Supabase
    const { data, error } = await supabase
      .from('internships')
      .insert([newEntry])
      .select(); // .select() เพื่อให้มันคืนค่าข้อมูลที่เซฟสำเร็จกลับมา (พร้อม id แท้จริง)

    if (error) {
      console.error('Error saving data:', error);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } else if (data) {
      // เซฟสำเร็จ: อัปเดตหน้าเว็บและล้างฟอร์ม
      setInternships([...internships, data[0]]);
      setFormData({
        name: '', department: '', contact: '', locationName: '',
        googleMapsUrl: '', distance: 0, travelTime: 0, travelCost: 0,
        status: 'รอการติดต่อ', remuneration: 0, personalPreference: 5
      });
      setShowAddForm(false);
    }
  };

  const deleteInternship = async (id) => {
    // 1. สั่งลบจาก Supabase ก่อน
    const { error } = await supabase
      .from('internships')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting data:', error);
      alert('ไม่สามารถลบข้อมูลได้');
    } else {
      // 2. ลบออกจากหน้าเว็บ
      setInternships(internships.filter(item => item.id !== id));
    }
  };

  const filteredAndSortedList = useMemo(() => {
    return internships
      .filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            item.department.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'ทั้งหมด' || item.status === filterStatus;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'score') return b.score - a.score;
        if (sortBy === 'pay') return b.remuneration - a.remuneration;
        return a.name.localeCompare(b.name);
      });
  }, [internships, searchTerm, filterStatus, sortBy]);

  const getStatusColor = (status) => {
    switch(status) {
      case 'ตอบรับ': return 'bg-green-100 text-green-800 border-green-200';
      case 'ยื่นเอกสารแล้ว': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'ไม่รับ': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-indigo-700 flex items-center gap-3">
              Internship Matcher <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-1 rounded-md">AI Powered</span>
            </h1>
            <p className="text-slate-500">เปรียบเทียบและจัดอันดับที่ฝึกงานด้วยระบบ AI</p>
          </div>
          <button 
            onClick={() => {
                setShowAddForm(!showAddForm);
                if (!showAddForm) window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl transition-all shadow-lg active:scale-95"
          >
            {showAddForm ? <ChevronUp size={20}/> : <Plus size={20}/>}
            เพิ่มที่ฝึกงาน
          </button>
        </header>

        {/* User Base Location */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row gap-4 items-center">
          <div className="flex items-center gap-2 text-indigo-600 font-semibold min-w-max">
            <MapPin size={20}/> ที่อยู่ของคุณ:
          </div>
          <input 
            type="text" 
            placeholder="ระบุที่อยู่ปัจจุบันของคุณ..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
            value={userLocation}
            onChange={(e) => setUserLocation(e.target.value)}
          />
        </div>

        {/* Add Form with AI Scanner */}
        {showAddForm && (
          <div className="bg-white p-6 rounded-2xl shadow-xl border border-indigo-100 mb-8 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Plus className="text-indigo-600"/> ข้อมูลที่ฝึกงานใหม่
              </h2>
              
              {/* AI Scanner Button */}
              <div className="relative group w-full md:w-auto">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleImageUpload}
                  className="hidden" 
                  id="ai-upload"
                  disabled={isProcessing}
                />
                <label 
                  htmlFor="ai-upload"
                  className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-all border-2 border-dashed ${isProcessing ? 'bg-slate-50 border-slate-300 text-slate-400' : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'}`}
                >
                  {isProcessing ? (
                    <><Loader2 size={18} className="animate-spin"/> AI กำลังอ่านรูปภาพ...</>
                  ) : (
                    <><Camera size={18}/> สแกนประกาศจากรูปภาพ</>
                  )}
                </label>
              </div>
            </div>

            <form onSubmit={handleAddInternship} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600">ชื่อสถานที่</label>
                <input required className="w-full border rounded-lg p-2 focus:border-indigo-500 outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600">แผนก/ตำแหน่ง</label>
                <input required className="w-full border rounded-lg p-2 focus:border-indigo-500 outline-none" value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600">ช่องทางติดต่อ</label>
                <input className="w-full border rounded-lg p-2 focus:border-indigo-500 outline-none" value={formData.contact} onChange={e => setFormData({...formData, contact: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600">Location (ชื่อสถานที่)</label>
                <input className="w-full border rounded-lg p-2 focus:border-indigo-500 outline-none" value={formData.locationName} onChange={e => setFormData({...formData, locationName: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600">Google Maps Link</label>
                <input className="w-full border rounded-lg p-2 focus:border-indigo-500 outline-none" placeholder="https://..." value={formData.googleMapsUrl} onChange={e => setFormData({...formData, googleMapsUrl: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600">ระยะทาง (กม.)</label>
                <input type="number" step="0.1" className="w-full border rounded-lg p-2 focus:border-indigo-500 outline-none" value={formData.distance} onChange={e => setFormData({...formData, distance: parseFloat(e.target.value) || 0})} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600">ระยะเวลาเดินทาง (นาที)</label>
                <input type="number" className="w-full border rounded-lg p-2 focus:border-indigo-500 outline-none" value={formData.travelTime} onChange={e => setFormData({...formData, travelTime: parseInt(e.target.value) || 0})} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600">ค่าเดินทาง (บาท/วัน)</label>
                <input type="number" className="w-full border rounded-lg p-2 focus:border-indigo-500 outline-none" value={formData.travelCost} onChange={e => setFormData({...formData, travelCost: parseInt(e.target.value) || 0})} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600">ค่าตอบแทน (บาท/วัน)</label>
                <input type="number" className="w-full border rounded-lg p-2 focus:border-indigo-500 outline-none" value={formData.remuneration} onChange={e => setFormData({...formData, remuneration: parseInt(e.target.value) || 0})} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600">สถานะ</label>
                <select className="w-full border rounded-lg p-2 bg-white focus:border-indigo-500 outline-none" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                  <option>รอการติดต่อ</option>
                  <option>ยื่นเอกสารแล้ว</option>
                  <option>ตอบรับ</option>
                  <option>ไม่รับ</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600">ความชอบส่วนตัว (1-10)</label>
                <div className="flex items-center gap-2">
                  <input type="range" min="1" max="10" className="w-full accent-indigo-600" value={formData.personalPreference} onChange={e => setFormData({...formData, personalPreference: parseInt(e.target.value)})} />
                  <span className="font-bold text-indigo-600 w-8 text-center">{formData.personalPreference}</span>
                </div>
              </div>
              <div className="md:col-span-2 lg:col-span-3 flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg">ยกเลิก</button>
                <button type="submit" className="px-8 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-md">บันทึกข้อมูล</button>
              </div>
            </form>
          </div>
        )}

        {/* Filters & Sorting */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
            <input 
              type="text" 
              placeholder="ค้นหาชื่อสถานที่ หรือ แผนก..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 rounded-xl">
              <Filter size={16} className="text-slate-400"/>
              <select className="py-2 outline-none bg-transparent text-sm font-medium" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option>ทั้งหมด</option>
                <option>รอการติดต่อ</option>
                <option>ยื่นเอกสารแล้ว</option>
                <option>ตอบรับ</option>
                <option>ไม่รับ</option>
              </select>
            </div>
            <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 rounded-xl">
              <TrendingUp size={16} className="text-slate-400"/>
              <select className="py-2 outline-none bg-transparent text-sm font-medium" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="score">เรียงตามคะแนน</option>
                <option value="pay">เรียงตามค่าตอบแทน</option>
                <option value="name">เรียงตามชื่อ</option>
              </select>
            </div>
          </div>
        </div>

        {/* List View */}
        <div className="grid grid-cols-1 gap-4">
          {filteredAndSortedList.length === 0 ? (
            <div className="bg-white py-20 rounded-3xl border-2 border-dashed border-slate-200 text-center text-slate-400">
              <ImageIcon className="mx-auto mb-2 opacity-20" size={48}/>
              <p>ยังไม่มีข้อมูลที่ฝึกงาน กดเพิ่มข้อมูลหรือสแกนรูปภาพเพื่อเริ่มต้น</p>
            </div>
          ) : (
            filteredAndSortedList.map((item, index) => (
              <div key={item.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 hover:border-indigo-200 transition-all group relative overflow-hidden">
                <div className={`absolute top-0 left-0 w-12 h-12 flex items-center justify-center font-bold text-lg ${index === 0 ? 'bg-yellow-400 text-yellow-900' : 'bg-slate-100 text-slate-500'}`}>
                  #{index + 1}
                </div>

                <div className="ml-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  <div className="lg:col-span-4">
                    <h3 className="text-xl font-bold text-slate-800 truncate">{item.name}</h3>
                    <p className="text-indigo-600 font-medium mb-2">{item.department}</p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className={`px-2 py-1 rounded-full border font-medium ${getStatusColor(item.status)}`}>
                        {item.status}
                      </span>
                      <span className="flex items-center gap-1 text-slate-500">
                        <Phone size={12}/> {item.contact || 'ไม่ระบุ'}
                      </span>
                    </div>
                  </div>

                  <div className="lg:col-span-5 grid grid-cols-2 sm:grid-cols-4 gap-4 border-l border-slate-100 pl-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">ระยะทาง</span>
                      <span className="font-bold text-slate-700">{item.distance} กม.</span>
                      <span className="text-[10px] text-slate-500">{item.travelTime} นาที</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">ค่าเดินทาง</span>
                      <span className="font-bold text-slate-700">{item.travelCost} ฿</span>
                      <span className="text-[10px] text-slate-500">/วัน</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">ค่าตอบแทน</span>
                      <span className="font-bold text-green-600">{item.remuneration} ฿</span>
                      <span className="text-[10px] text-slate-500">/วัน</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">ความชอบ</span>
                      <div className="flex items-center gap-1 text-orange-500 font-bold">
                        <Star size={14} fill="currentColor"/> {item.personalPreference}
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-3 flex flex-row lg:flex-col items-center justify-between lg:justify-center gap-4 border-l border-slate-100 pl-4">
                    <div className="text-center">
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">คะแนนรวม</div>
                      <div className="text-3xl font-black text-indigo-600">{item.score}</div>
                    </div>
                    <div className="flex gap-2">
                      {item.googleMapsUrl && (
                        <a href={item.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
                          <ExternalLink size={20}/>
                        </a>
                      )}
                      <button onClick={() => deleteInternship(item.id)} className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors">
                        <Trash2 size={20}/>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <footer className="mt-12 p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <h4 className="font-bold mb-4 flex items-center gap-2 text-indigo-700"><Info size={18}/> วิธีใช้ AI ช่วยกรอกข้อมูล</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-slate-600">
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">1</div>
              <p>แคปภาพหน้าจอประกาศรับสมัครงานหรือถ่ายรูปใบปลิว</p>
            </div>
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">2</div>
              <p>กดปุ่ม <strong>"สแกนประกาศจากรูปภาพ"</strong> ในหน้าต่างเพิ่มข้อมูล</p>
            </div>
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">3</div>
              <p>ตรวจสอบข้อมูลที่ AI ดึงมาให้ แล้วกดบันทึกเพื่อจัดอันดับ</p>
            </div>
          </div>
        </footer>

      </div>
    </div>
  );
}

export default App
