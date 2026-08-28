import { FileText, Download, Sparkles } from 'lucide-react';

export default function StudentDashboard() {
  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Student Resources</h1>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium flex items-center gap-2">
          Upload Resource
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Sample Resource Card */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group relative">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <FileText className="w-6 h-6" />
            </div>
            <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-medium">Approved</span>
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Advanced Data Structures.pdf</h3>
          <p className="text-gray-500 text-sm mb-4 line-clamp-2">Complete notes on Trees, Graphs, and Dynamic Programming algorithms with code examples.</p>
          
          <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-50">
            <button className="text-indigo-600 hover:text-indigo-800 text-sm font-medium flex items-center gap-1 transition-colors">
              <Sparkles className="w-4 h-4" /> AI Summary
            </button>
            <button className="text-gray-400 hover:text-gray-600 transition-colors">
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
