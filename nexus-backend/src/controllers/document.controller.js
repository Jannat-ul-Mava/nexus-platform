const Document = require('../models/Document.model');
const { createNotification } = require('../utils/notification.utils');
const path = require('path');
const fs = require('fs');

// Try cloudinary, fall back to local storage
let useCloudinary = false;
let cloudinaryUtils = null;
try {
  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_CLOUD_NAME !== 'placeholder') {
    cloudinaryUtils = require('../utils/cloudinary.utils');
    useCloudinary = true;
    console.log('✅ Cloudinary configured');
  } else {
    console.log('ℹ️  Cloudinary not configured — using local file storage');
  }
} catch {}

const uploadFile = async (buffer, folder, mimetype, originalname) => {
  if (useCloudinary && cloudinaryUtils) {
    const result = await cloudinaryUtils.uploadToCloudinary(buffer, { folder: `nexus/${folder}`, resource_type: 'auto' });
    return { url: result.secure_url, publicId: result.public_id };
  }
  const uploadsDir = path.join(process.cwd(), 'uploads', folder);
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  const ext = path.extname(originalname || '').toLowerCase() || '.bin';
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const filepath = path.join(uploadsDir, filename);
  fs.writeFileSync(filepath, buffer);
  const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
  return { url: `${baseUrl}/uploads/${folder}/${filename}`, publicId: filename };
};

exports.uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
    const { name, description, category, sharedWith, requiresSignature, signatureRequestedFrom } = req.body;
    const ext = path.extname(req.file.originalname || '').toLowerCase().replace('.', '') || req.file.mimetype.split('/')[1];
    const result = await uploadFile(req.file.buffer, 'documents', req.file.mimetype, req.file.originalname);
    const document = await Document.create({
      name: name || req.file.originalname,
      description, fileType: req.file.mimetype, fileExtension: ext,
      owner: req.user._id, category: category || 'other',
      sharedWith: sharedWith ? JSON.parse(sharedWith) : [],
      requiresSignature: requiresSignature === 'true',
      signatureRequestedFrom: signatureRequestedFrom ? JSON.parse(signatureRequestedFrom) : [],
      currentVersion: 1,
      versions: [{ version: 1, fileUrl: result.url, publicId: result.publicId, uploadedBy: req.user._id, fileSize: req.file.size }]
    });
    if (document.sharedWith?.length) {
      for (const userId of document.sharedWith) {
        await createNotification({ recipient: userId, type: 'document_shared', title: 'Document Shared With You', message: `${req.user.name} shared "${document.name}" with you.`, actionUrl: `/documents/${document._id}`, relatedId: document._id.toString() });
      }
    }
    const populated = await document.populate('owner', 'name avatarUrl');
    res.status(201).json({ success: true, document: populated });
  } catch (error) { next(error); }
};

exports.getMyDocuments = async (req, res, next) => {
  try {
    const { category, status, search } = req.query;
    const query = { $or: [{ owner: req.user._id }, { sharedWith: req.user._id }], isDeleted: false };
    if (category) query.category = category;
    if (status) query.status = status;
    if (search) query.name = { $regex: search, $options: 'i' };
    const documents = await Document.find(query)
      .populate('owner', 'name avatarUrl')
      .populate('sharedWith', 'name avatarUrl')
      .populate('signatures.user', 'name avatarUrl')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, documents });
  } catch (error) { next(error); }
};

exports.getDocument = async (req, res, next) => {
  try {
    const document = await Document.findById(req.params.id)
      .populate('owner', 'name avatarUrl email')
      .populate('sharedWith', 'name avatarUrl')
      .populate('signatures.user', 'name avatarUrl')
      .populate('signatureRequestedFrom', 'name avatarUrl');
    if (!document || document.isDeleted) return res.status(404).json({ success: false, message: 'Document not found.' });
    const isOwner = document.owner._id.equals(req.user._id);
    const isShared = document.sharedWith.some(u => u._id.equals(req.user._id));
    if (!isOwner && !isShared && !document.isPublic) return res.status(403).json({ success: false, message: 'Access denied.' });
    const currentVersionData = document.versions.find(v => v.version === document.currentVersion);
    res.status(200).json({ success: true, document, fileUrl: currentVersionData?.fileUrl });
  } catch (error) { next(error); }
};

exports.uploadNewVersion = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
    const document = await Document.findById(req.params.id);
    if (!document || document.isDeleted) return res.status(404).json({ success: false, message: 'Document not found.' });
    if (!document.owner.equals(req.user._id)) return res.status(403).json({ success: false, message: 'Only the owner can upload new versions.' });
    const result = await uploadFile(req.file.buffer, 'documents', req.file.mimetype, req.file.originalname);
    document.currentVersion += 1;
    document.versions.push({ version: document.currentVersion, fileUrl: result.url, publicId: result.publicId, uploadedBy: req.user._id, fileSize: req.file.size, changeNote: req.body.changeNote });
    document.status = 'draft';
    await document.save();
    res.status(200).json({ success: true, message: 'New version uploaded.', document });
  } catch (error) { next(error); }
};

exports.signDocument = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Signature image required.' });
    const document = await Document.findById(req.params.id).populate('owner', 'name email');
    if (!document || document.isDeleted) return res.status(404).json({ success: false, message: 'Document not found.' });
    const alreadySigned = document.signatures.some(s => s.user.equals(req.user._id));
    if (alreadySigned) return res.status(400).json({ success: false, message: 'You have already signed this document.' });
    const result = await uploadFile(req.file.buffer, 'signatures', req.file.mimetype, req.file.originalname);
    document.signatures.push({ user: req.user._id, signatureImageUrl: result.url, ipAddress: req.ip });
    const allSigned = document.signatureRequestedFrom.every(userId => document.signatures.some(s => s.user.equals(userId)));
    if (allSigned) document.status = 'signed';
    await document.save();
    await createNotification({ recipient: document.owner._id, type: 'document_signed', title: 'Document Signed', message: `${req.user.name} signed "${document.name}".`, actionUrl: `/documents/${document._id}`, relatedId: document._id.toString() });
    res.status(200).json({ success: true, message: 'Document signed successfully.', document });
  } catch (error) { next(error); }
};

exports.shareDocument = async (req, res, next) => {
  try {
    const { userIds } = req.body;
    const document = await Document.findById(req.params.id);
    if (!document) return res.status(404).json({ success: false, message: 'Document not found.' });
    if (!document.owner.equals(req.user._id)) return res.status(403).json({ success: false, message: 'Only the owner can share this document.' });
    const newIds = userIds.filter(id => !document.sharedWith.map(String).includes(String(id)));
    document.sharedWith.push(...newIds);
    await document.save();
    for (const userId of newIds) {
      await createNotification({ recipient: userId, type: 'document_shared', title: 'Document Shared With You', message: `${req.user.name} shared "${document.name}" with you.`, actionUrl: `/documents/${document._id}`, relatedId: document._id.toString() });
    }
    res.status(200).json({ success: true, message: 'Document shared.', document });
  } catch (error) { next(error); }
};

exports.deleteDocument = async (req, res, next) => {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) return res.status(404).json({ success: false, message: 'Document not found.' });
    if (!document.owner.equals(req.user._id)) return res.status(403).json({ success: false, message: 'Only the owner can delete this document.' });
    document.isDeleted = true;
    await document.save();
    res.status(200).json({ success: true, message: 'Document deleted.' });
  } catch (error) { next(error); }
};
