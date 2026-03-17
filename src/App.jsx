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
  Image as ImageIcon,
  Pencil,
  X
} from 'lucide-react';

function App() {
  const [internships, setInternships] = useState([]);
  const [userLocation, setUserLocation] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ทั้งหมด');
  const [sortBy, setSortBy] = useState('score');
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showMapConfirm, setShowMapConfirm] = useState(false);
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  const initialFormState = {
    name: '',
    department: '',
    contact: '',
    locationName: '',
    googleMapsUrl: '',
    distance: '',
    travelTime: '',
    travelCost: '',
    status: 'รอการติดต่อ',
    remuneration: '',
    personalPreference: 5,
    travelMethod: '',
  };

  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    fetchInternships();
  }, []);

  const fetchInternships = async () => {
    const { data, error } = await supabase
      .from('internships')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.error('Error fetching data:', error);
    } else if (data) {
      setInternships(data);
    }
  };

  const processImageWithAI = async (base64Image) => {
    setIsProcessing(true);
    const prompt = `Analyze this internship recruitment post/image and extract details. 
Return ONLY a JSON object with these keys: 
{ 
  "name": "company name", 
  "department": "position/dept", 
  "contact": "phone/email/line", 
  "locationName": "full detailed address (house no, building, road, sub-district, district, province)", 
  "remuneration": number, 
  "distance": number, 
  "travelTime": number 
}.`;
    const payload = {
      contents: [{
        role: "user",
        parts: [
          { text: prompt },
          { inlineData: { mimeType: "image/png", data: base64Image.split(',')[1] } }
        ]
      }]
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();
      const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
      const jsonStr = textResponse.match(/\{[\s\S]*\}/)?.[0];

      if (jsonStr) {
  const extractedData = JSON.parse(jsonStr);
  const autoMapsUrl = extractedData.name 
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(extractedData.name)}`
    : '';

  setFormData(prev => ({
    ...prev,
    ...extractedData,
    googleMapsUrl: autoMapsUrl
  }));

  // ✨ เพิ่มบรรทัดนี้: เมื่อสแกนเสร็จ ให้เด้งป๊อปอัพขึ้นมาทันที
  setShowMapConfirm(true); 
}
    } catch (error) {
      console.error("AI Error:", error);
      alert("AI ไม่สามารถอ่านข้อมูลจากรูปนี้ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => processImageWithAI(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const calculateScores = (item) => {
    const distance = parseFloat(item.distance) || 0;
    const travelCost = parseFloat(item.travelCost) || 0;
    const remuneration = parseFloat(item.remuneration) || 0;
    
    const distanceScore = Math.max(0, 10 - (distance / 3));
    const costScore = Math.max(0, 10 - (travelCost / 20));
    const payScore = Math.min(10, (remuneration / 50));
    const total = (distanceScore * 2) + (costScore * 2) + (payScore * 3) + (item.personalPreference * 3);
    return parseFloat((total).toFixed(2));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 1. สร้างข้อมูลที่สะอาดก่อนส่ง (แปลงค่าว่างกลับเป็นตัวเลข 0)
    const sanitizedData = {
      ...formData,
      distance: parseFloat(formData.distance) || 0,
      travelTime: parseInt(formData.travelTime) || 0,
      travelCost: parseInt(formData.travelCost) || 0,
      remuneration: parseInt(formData.remuneration) || 0,
      personalPreference: parseInt(formData.personalPreference) || 5,
    };

    // 2. คำนวณคะแนนจากข้อมูลที่สะอาดแล้ว
    const newScore = calculateScores(sanitizedData);
    const submissionData = { ...sanitizedData, score: newScore };

    if (editingId) {
      // กรณี: แก้ไขข้อมูลเดิม
      const { data, error } = await supabase
        .from('internships')
        .update(submissionData)
        .eq('id', editingId)
        .select();

      if (error) {
        alert('แก้ไขไม่สำเร็จ: ' + error.message);
      } else {
        setInternships(internships.map(item => item.id === editingId ? data[0] : item));
        alert('อัปเดตข้อมูลเรียบร้อย!');
        setEditingId(null);
        setFormData(initialFormState); // ล้างฟอร์ม
        setShowAddForm(false);
      }
    } else {
      // กรณี: เพิ่มข้อมูลใหม่
      const { data, error } = await supabase
        .from('internships')
        .insert([submissionData])
        .select();

      if (error) {
        alert('บันทึกไม่สำเร็จ: ' + error.message);
      } else if (data) {
        setInternships([...internships, data[0]]);
        alert('บันทึกสำเร็จ!');
        setFormData(initialFormState); // ล้างฟอร์ม
        setShowAddForm(false);
      }
    }
  };

  const handleEdit = (item) => {
    setFormData(item);
    setEditingId(item.id);
    setShowAddForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancel = () => {
    setFormData(initialFormState);
    setEditingId(null);
    setShowAddForm(false);
  };

  const deleteInternship = async (id) => {
    if (!window.confirm('คุณต้องการลบข้อมูลนี้ใช่หรือไม่?')) return;
    const { error } = await supabase.from('internships').delete().eq('id', id);
    if (!error) setInternships(internships.filter(item => item.id !== id));
  };

  // ✨ [เพิ่ม] ฟังก์ชันสำหรับเปิด Google Maps นำทาง
  const openGoogleMapsDirections = () => {
    if (!userLocation || !formData.name) {
      alert('กรุณาระบุที่อยู่ของคุณที่ช่องด้านบนสุด และชื่อสถานที่ในฟอร์มก่อนครับ');
      return;
    }
    const origin = encodeURIComponent(userLocation);
    const destination = encodeURIComponent(formData.locationName || formData.name);
    
    // URL สำหรับเปิด Google Maps นำทาง
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
    
    window.open(mapsUrl, '_blank');
  };

  const filteredAndSortedList = useMemo(() => {
    return internships
      .filter(item => {
        const matchesSearch = (item.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (item.department || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'ทั้งหมด' || item.status === filterStatus;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'score') return b.score - a.score;
        if (sortBy === 'pay') return (b.remuneration || 0) - (a.remuneration || 0);
        return (a.name || '').localeCompare(b.name || '');
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
                if(showAddForm) handleCancel();
                else setShowAddForm(true);
            }}
            className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl transition-all shadow-lg active:scale-95 text-white ${showAddForm ? 'bg-slate-500 hover:bg-slate-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}
          >
            {showAddForm ? <X size={20}/> : <Plus size={20}/>}
            {showAddForm ? 'ยกเลิก' : (editingId ? 'กำลังแก้ไข' : 'เพิ่มที่ฝึกงาน')}
          </button>
        </header>

        {/* User Base Location */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row gap-4 items-center">
          <div className="flex items-center gap-2 text-indigo-600 font-semibold min-w-max">
            <MapPin size={20}/> ที่อยู่ของคุณ:
          </div>
          <input 
            type="text" 
            placeholder="ระบุที่อยู่ปัจจุบันของคุณ (เช่น ชื่อมหาวิทยาลัย, หอพัก)..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
            value={userLocation}
            onChange={(e) => setUserLocation(e.target.value)}
          />
        </div>

        {/* Add/Edit Form */}
        {showAddForm && (
          <div className="bg-white p-6 rounded-2xl shadow-xl border border-indigo-100 mb-8 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                {editingId ? <Pencil className="text-orange-500"/> : <Plus className="text-indigo-600"/>}
                {editingId ? 'แก้ไขข้อมูลที่ฝึกงาน' : 'ข้อมูลที่ฝึกงานใหม่'}
              </h2>
              
              {!editingId && (
                <div className="relative group w-full md:w-auto">
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" id="ai-upload" disabled={isProcessing}/>
                  <label htmlFor="ai-upload" className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg cursor-pointer border-2 border-dashed ${isProcessing ? 'bg-slate-50 text-slate-400' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}>
                    {isProcessing ? <><Loader2 size={18} className="animate-spin"/> AI กำลังอ่านรูป...</> : <><Camera size={18}/> สแกนรูปภาพ</>}
                  </label>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600">ชื่อสถานที่</label>
                <input required className="w-full border rounded-lg p-2 outline-none focus:border-indigo-500" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600">แผนก/ตำแหน่ง</label>
                <input required className="w-full border rounded-lg p-2 outline-none focus:border-indigo-500" value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600">ช่องทางติดต่อ</label>
                <input className="w-full border rounded-lg p-2 outline-none focus:border-indigo-500" value={formData.contact} onChange={e => setFormData({...formData, contact: e.target.value})} />
              </div>
              {/* ช่องที่ตั้ง/ที่อยู่ (เพิ่มกลับมาและให้ AI กรอกอัตโนมัติ) */}
<div className="space-y-1 md:col-span-2 lg:col-span-3">
  <label className="text-sm font-medium text-slate-600">ที่ตั้ง/ที่อยู่ละเอียด (AI จะสกัดจากรูปให้)</label>
  <textarea 
    rows="2"
    className="w-full border rounded-lg p-2 outline-none focus:border-indigo-500 text-sm" 
    placeholder="บ้านเลขที่, ถนน, แขวง/ตำบล, เขต/อำเภอ..." 
    value={formData.locationName} 
    onChange={e => setFormData({...formData, locationName: e.target.value})} 
  />
</div>
              {/* Google Maps Link Field */}
              <div className="space-y-1 md:col-span-2 lg:col-span-3">
                <label className="text-sm font-medium text-slate-600 flex justify-between">
                  <span>Google Maps Link (AI จะสร้างให้อัตโนมัติหลังสแกน)</span>
                  {formData.googleMapsUrl && (
                     <a href={formData.googleMapsUrl} target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline">ทดสอบเปิดแผนที่</a>
                  )}
                </label>
                <input className="w-full border rounded-lg p-2 outline-none focus:border-indigo-500 text-sm text-blue-600" placeholder="https://www.google.com/maps/..." value={formData.googleMapsUrl} onChange={e => setFormData({...formData, googleMapsUrl: e.target.value})} />
              </div>
              
              {/* ระยะทาง พร้อมปุ่มเช็กใน Maps */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600 flex justify-between items-center">
                  <span>ระยะทาง (กม.)</span>
                  <button 
                    type="button"
                    onClick={openGoogleMapsDirections}
                    className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded hover:bg-indigo-100 transition-colors flex items-center gap-1 border border-indigo-200"
                  >
                    <ExternalLink size={10}/> เช็กใน Maps
                  </button>
                </label>
                <input type="number" step="0.1" placeholder="0" className="w-full border rounded-lg p-2 outline-none focus:border-indigo-500" value={formData.distance} onChange={e => setFormData({...formData, distance: e.target.value})} />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600">ระยะเวลาเดินทาง (นาที)</label>
                <input type="number" placeholder="0" className="w-full border rounded-lg p-2 outline-none focus:border-indigo-500" value={formData.travelTime} onChange={e => setFormData({...formData, travelTime: e.target.value})} />
              </div>
              <div className="space-y-1">
  <label className="text-sm font-medium text-slate-600">วิธีการเดินทาง</label>
  <select 
    className="w-full border rounded-lg p-2 bg-white outline-none focus:border-indigo-500" 
    value={formData.travelMethod} 
    onChange={e => setFormData({...formData, travelMethod: e.target.value})}
  >
    <option value="รถเมล์">🚌 รถเมล์</option>
    <option value="รถส่วนตัว">🚗 รถส่วนตัว</option>
    <option value="รถไฟฟ้า">🚆 รถไฟฟ้า</option>
    <option value="เดิน">🚶 เดิน</option>
  </select>
</div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600">ค่าเดินทาง (บาท/วัน)</label>
                <input type="number" placeholder="0" className="w-full border rounded-lg p-2 outline-none focus:border-indigo-500" value={formData.travelCost} onChange={e => setFormData({...formData, travelCost: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600">ค่าตอบแทน (บาท/วัน)</label>
                <input type="number" placeholder="0" className="w-full border rounded-lg p-2 outline-none focus:border-indigo-500" value={formData.remuneration} onChange={e => setFormData({...formData, remuneration: e.target.value})} />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600">สถานะ</label>
                <select className="w-full border rounded-lg p-2 bg-white outline-none focus:border-indigo-500" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
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

              <div className="md:col-span-2 lg:col-span-3 flex justify-end gap-2 pt-4 border-t mt-4">
                <button type="button" onClick={handleCancel} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">ยกเลิก</button>
                <button type="submit" className={`px-8 py-2 text-white rounded-lg shadow-md transition-all active:scale-95 ${editingId ? 'bg-orange-500 hover:bg-orange-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                  {editingId ? 'อัปเดตข้อมูล' : 'บันทึกข้อมูลใหม่'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Search & Filters */}
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
              <p>ยังไม่มีข้อมูล หรือ ไม่พบข้อมูลที่ค้นหา</p>
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
                      {item.contact && (
                        <span className="flex items-center gap-1 text-slate-500">
                          <Phone size={12}/> {item.contact}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="lg:col-span-5 grid grid-cols-2 sm:grid-cols-4 gap-4 border-l border-slate-100 pl-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">ระยะทาง</span>
                      <span className="font-bold text-slate-700">{item.distance || 0} กม.</span>
                    </div>
                    <div className="flex flex-col">
    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">วิธีเดินทาง</span>
  <span className="font-medium text-slate-700 text-sm">{item.travelMethod || 'ไม่ระบุ'}</span>
</div>
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">ค่าเดินทาง</span>
                      <span className="font-bold text-slate-700">{item.travelCost || 0} ฿</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">ค่าตอบแทน</span>
                      <span className="font-bold text-green-600">{item.remuneration || 0} ฿</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">คะแนน</span>
                      <span className="font-bold text-indigo-600 text-lg">{item.score}</span>
                    </div>
                  </div>

                  <div className="lg:col-span-3 flex justify-end gap-2 border-l border-slate-100 pl-4">
                    <button onClick={() => handleEdit(item)} className="p-2 text-orange-400 hover:bg-orange-50 rounded-lg transition-colors" title="แก้ไข">
                      <Pencil size={20}/>
                    </button>
                    <button onClick={() => deleteInternship(item.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors" title="ลบ">
                      <Trash2 size={20}/>
                    </button>
                    {item.googleMapsUrl && (
                      <a href={item.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="เปิดแผนที่">
                        <ExternalLink size={20}/>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer / Instructions */}
        <footer className="mt-12 p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <h4 className="font-bold mb-4 flex items-center gap-2 text-indigo-700"><Info size={18}/> วิธีใช้ AI ช่วยกรอกข้อมูลให้เร็วขึ้น</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-slate-600">
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">1</div>
              <p>กด <strong>"สแกนรูปภาพ"</strong> แล้วเลือกรูปประกาศรับสมัครงาน AI จะกรอกชื่อ แผนก และสร้างลิงก์แผนที่ให้อัตโนมัติ</p>
            </div>
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">2</div>
              <p>ระบุ "ที่อยู่ของคุณ" ด้านบนสุด แล้วกด <strong>"เช็กใน Maps"</strong> เพื่อดูระยะทางจริงแล้วนำมากรอก</p>
            </div>
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">3</div>
              <p>กดบันทึกข้อมูล ระบบจะคำนวณคะแนนความคุ้มค่าและจัดอันดับที่ฝึกงานให้คุณโดยอัตโนมัติ</p>
            </div>
          </div>
        </footer>

      </div>
      {/* --- ป๊อปอัพยืนยันสถานที่บน Google Maps (เวอร์ชันเพิ่มที่อยู่) --- */}
{showMapConfirm && (
  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
    <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 text-center animate-in zoom-in duration-300">
      <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
        <MapPin size={32} />
      </div>
      
      <h3 className="text-xl font-bold text-slate-800 mb-2">ตรวจสอบที่อยู่?</h3>
      
      <div className="bg-slate-50 p-4 rounded-2xl mb-6 text-left">
        <div className="mb-3">
          <p className="text-slate-400 text-[10px] uppercase font-black tracking-widest mb-1">บริษัท</p>
          <p className="text-slate-800 font-bold">{formData.name || 'ไม่ระบุ'}</p>
        </div>
        
        <div>
          <p className="text-slate-400 text-[10px] uppercase font-black tracking-widest mb-1">ที่อยู่ละเอียด (จากรูป)</p>
          <p className="text-indigo-600 font-medium text-sm leading-relaxed">
            {formData.locationName || 'ไม่พบข้อมูลที่อยู่บนรูป'}
          </p>
        </div>
      </div>
      
      <div className="space-y-3">
        <button 
          onClick={() => window.open(formData.googleMapsUrl, '_blank')}
          className="w-full py-3 bg-white border-2 border-indigo-600 text-indigo-600 rounded-xl font-bold hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2"
        >
          <ExternalLink size={18}/> เช็กตำแหน่งใน Maps
        </button>

        <button 
          onClick={() => setShowMapConfirm(false)}
          className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg transition-all active:scale-95"
        >
          ยืนยัน ข้อมูลถูกต้อง
        </button>

        <button 
          onClick={() => {
            setShowMapConfirm(false);
          }}
          className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
        >
          ปิดหน้าต่างนี้
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
}

export default App;