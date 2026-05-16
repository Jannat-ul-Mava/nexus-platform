import React, { useState, useEffect, useRef } from 'react';
import { FileText, Upload, Download, Trash2, Share2, Eye, PenTool, X, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { documentAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

interface Document {
  _id: string;
  name: string;
  fileType: string;
  fileExtension: string;
  category: string;
  status: string;
  currentVersion: number;
  owner: { _id: string; name: string; avatarUrl: string };
  sharedWith: { _id: string; name: string }[];
  signatures: { user: { _id: string; name: string }; signedAt: string }[];
  requiresSignature: boolean;
  versions: { fileUrl: string; fileSize: number; uploadedAt: string }[];
  createdAt: string;
}

const formatSize = (bytes?: number) => {
  if (!bytes) return 'Unknown size';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

const getFileTypeLabel = (ext: string) => {
  const map: Record<string, string> = {
    pdf: 'PDF', docx: 'Word', doc: 'Word', xlsx: 'Excel',
    xls: 'Excel', pptx: 'PowerPoint', ppt: 'PowerPoint',
    png: 'Image', jpg: 'Image', jpeg: 'Image'
  };
  return map[ext?.toLowerCase()] || ext?.toUpperCase() || 'File';
};

const statusColor: Record<string, 'success' | 'warning' | 'error' | 'secondary' | 'primary'> = {
  signed: 'success', approved: 'success',
  'pending-review': 'warning', draft: 'secondary', rejected: 'error'
};

export const DocumentsPage: React.FC = () => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'mine' | 'shared'>('all');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showSignModal, setShowSignModal] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);

  // Upload form state
  const [uploadForm, setUploadForm] = useState({
    name: '', category: 'other', description: '', requiresSignature: false
  });

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const res = await documentAPI.getAll();
      setDocuments(res.data.documents);
    } catch {
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDocuments(); }, []);

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return toast.error('Please select a file');
    if (!uploadForm.name.trim()) return toast.error('Please enter a document name');

    setUploading(true);
    try {
      await documentAPI.upload(file, {
        name: uploadForm.name,
        category: uploadForm.category,
        description: uploadForm.description,
        requiresSignature: uploadForm.requiresSignature
      });
      toast.success('Document uploaded successfully!');
      setShowUploadModal(false);
      setUploadForm({ name: '', category: 'other', description: '', requiresSignature: false });
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchDocuments();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string, docName: string) => {
    if (!confirm(`Delete "${docName}"? This cannot be undone.`)) return;
    try {
      await documentAPI.delete(docId);
      toast.success('Document deleted');
      setDocuments(prev => prev.filter(d => d._id !== docId));
    } catch {
      toast.error('Failed to delete document');
    }
  };

  const handlePreview = async (docId: string) => {
    try {
      const res = await documentAPI.getById(docId);
      const url = res.data.fileUrl;
      if (url) {
        setPreviewUrl(url);
      } else {
        toast.error('Preview not available');
      }
    } catch {
      toast.error('Could not load preview');
    }
  };

  const handleDownload = async (docId: string, name: string) => {
    try {
      const res = await documentAPI.getById(docId);
      const url = res.data.fileUrl;
      if (url) {
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.target = '_blank';
        a.click();
      }
    } catch {
      toast.error('Could not download file');
    }
  };

  const handleSign = async (docId: string) => {
    const file = signatureInputRef.current?.files?.[0];
    if (!file) return toast.error('Please select a signature image');
    try {
      await documentAPI.sign(docId, file);
      toast.success('Document signed successfully!');
      setShowSignModal(null);
      if (signatureInputRef.current) signatureInputRef.current.value = '';
      fetchDocuments();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Signing failed');
    }
  };

  const filteredDocs = documents.filter(doc => {
    if (filter === 'mine') return doc.owner._id === user?._id || doc.owner._id === user?.id;
    if (filter === 'shared') return doc.sharedWith?.length > 0;
    return true;
  });

  const totalSize = documents.reduce((sum, doc) => {
    const latestVersion = doc.versions?.[doc.versions.length - 1];
    return sum + (latestVersion?.fileSize || 0);
  }, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="text-gray-600">Manage your startup's important files</p>
        </div>
        <Button leftIcon={<Upload size={18} />} onClick={() => setShowUploadModal(true)}>
          Upload Document
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <h2 className="text-lg font-medium text-gray-900">Storage</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Used</span>
                <span className="font-medium text-gray-900">{formatSize(totalSize)}</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full">
                <div className="h-2 bg-primary-600 rounded-full" style={{ width: '25%' }} />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Files</span>
                <span className="font-medium text-gray-900">{documents.length}</span>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Filter</h3>
              <div className="space-y-1">
                {(['all', 'mine', 'shared'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                      filter === f ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {f === 'all' ? 'All Files' : f === 'mine' ? 'My Files' : 'Shared with Me'}
                  </button>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Document List */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900">
                {filter === 'all' ? 'All Documents' : filter === 'mine' ? 'My Documents' : 'Shared with Me'}
                <span className="ml-2 text-sm text-gray-500">({filteredDocs.length})</span>
              </h2>
            </CardHeader>
            <CardBody>
              {loading ? (
                <div className="flex items-center justify-center py-12 text-gray-500">
                  <Loader size={24} className="animate-spin mr-2" />
                  Loading documents...
                </div>
              ) : filteredDocs.length === 0 ? (
                <div className="text-center py-12">
                  <FileText size={48} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 font-medium">No documents yet</p>
                  <p className="text-gray-400 text-sm mt-1">Upload your first document to get started</p>
                  <Button className="mt-4" leftIcon={<Upload size={16} />} onClick={() => setShowUploadModal(true)}>
                    Upload Document
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredDocs.map(doc => {
                    const isOwner = doc.owner._id === user?._id || doc.owner._id === user?.id;
                    const hasSigned = doc.signatures?.some(s => s.user._id === user?._id || s.user._id === user?.id);
                    const needsSignature = doc.requiresSignature && !hasSigned;
                    const latestVersion = doc.versions?.[doc.versions.length - 1];

                    return (
                      <div key={doc._id} className="flex items-center p-4 hover:bg-gray-50 rounded-lg transition-colors duration-200 border border-transparent hover:border-gray-200">
                        <div className="p-2 bg-primary-50 rounded-lg mr-4 flex-shrink-0">
                          <FileText size={24} className="text-primary-600" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-medium text-gray-900 truncate">{doc.name}</h3>
                            {doc.sharedWith?.length > 0 && <Badge variant="secondary" size="sm">Shared</Badge>}
                            {doc.status && doc.status !== 'draft' && (
                              <Badge variant={statusColor[doc.status] || 'secondary'} size="sm">
                                {doc.status}
                              </Badge>
                            )}
                            {needsSignature && (
                              <Badge variant="warning" size="sm">Needs signature</Badge>
                            )}
                            {hasSigned && (
                              <Badge variant="success" size="sm">Signed</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                            <span>{getFileTypeLabel(doc.fileExtension)}</span>
                            <span>{formatSize(latestVersion?.fileSize)}</span>
                            <span>v{doc.currentVersion}</span>
                            <span>by {isOwner ? 'you' : doc.owner.name}</span>
                            <span>{formatDate(doc.createdAt)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 ml-4 flex-shrink-0">
                          <Button variant="ghost" size="sm" className="p-2" aria-label="Preview"
                            onClick={() => handlePreview(doc._id)}>
                            <Eye size={16} />
                          </Button>
                          <Button variant="ghost" size="sm" className="p-2" aria-label="Download"
                            onClick={() => handleDownload(doc._id, doc.name)}>
                            <Download size={16} />
                          </Button>
                          {needsSignature && (
                            <Button variant="ghost" size="sm" className="p-2 text-primary-600" aria-label="Sign"
                              onClick={() => setShowSignModal(doc._id)}>
                              <PenTool size={16} />
                            </Button>
                          )}
                          {isOwner && (
                            <Button variant="ghost" size="sm" className="p-2 text-error-600 hover:text-error-700"
                              aria-label="Delete" onClick={() => handleDelete(doc._id, doc.name)}>
                              <Trash2 size={16} />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Upload Document</h2>
              <button onClick={() => setShowUploadModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Document Name *</label>
                <input
                  type="text"
                  value={uploadForm.name}
                  onChange={e => setUploadForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Pitch Deck Q1 2026"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={uploadForm.category}
                  onChange={e => setUploadForm(p => ({ ...p, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="pitch-deck">Pitch Deck</option>
                  <option value="contract">Contract</option>
                  <option value="term-sheet">Term Sheet</option>
                  <option value="nda">NDA</option>
                  <option value="financial">Financial</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <textarea
                  value={uploadForm.description}
                  onChange={e => setUploadForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Brief description..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">File *</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg"
                  className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                />
                <p className="text-xs text-gray-400 mt-1">PDF, Word, Excel, PowerPoint, Images (max 25MB)</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="reqSign"
                  checked={uploadForm.requiresSignature}
                  onChange={e => setUploadForm(p => ({ ...p, requiresSignature: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="reqSign" className="text-sm text-gray-700">Requires signature</label>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t">
              <Button variant="outline" fullWidth onClick={() => setShowUploadModal(false)}>Cancel</Button>
              <Button fullWidth isLoading={uploading} onClick={handleUpload} leftIcon={<Upload size={16} />}>
                Upload
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Sign Modal */}
      {showSignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Sign Document</h2>
              <button onClick={() => setShowSignModal(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                <CheckCircle size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-700">Upload an image of your signature to sign this document. Your signature will be linked to your account.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Signature Image *</label>
                <input
                  ref={signatureInputRef}
                  type="file"
                  accept="image/*"
                  className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                />
                <p className="text-xs text-gray-400 mt-1">PNG, JPG (max 2MB)</p>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t">
              <Button variant="outline" fullWidth onClick={() => setShowSignModal(null)}>Cancel</Button>
              <Button fullWidth onClick={() => handleSign(showSignModal)} leftIcon={<PenTool size={16} />}>
                Sign Document
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl h-5/6 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Document Preview</h2>
              <button onClick={() => setPreviewUrl(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              {previewUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                <img src={previewUrl} alt="Preview" className="w-full h-full object-contain p-4" />
              ) : (
                <iframe src={previewUrl} className="w-full h-full" title="Document preview" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
