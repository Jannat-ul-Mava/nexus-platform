const Document = require('../models/Document.model');
const { uploadToCloudinary, deleteFromCloudinary } = require('../utils/cloudinary.utils');
const { createNotification } = require('../utils/notification.utils');
const path = require('path');

const getFileExtension = (mimetype, originalname) => {
  const ext = path.extname(originalname).toLowerCase().replace('.', '');
  return ext || mimetype.split('/')[1];
};

// ─── Upload Document ──────────────────────────────────────────────────────────
exports.uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const { name, description, category, sharedWith, requiresSignature, signatureRequestedFrom } = req.body;
    const ext = getFileExtension(req.file.mimetype, req.file.originalname);

    const result = await uploadToCloudinary(req.file.buffer, {
      folder: 'nexus/documents',
      resource_type: 'auto',
      use_filename: true,
      unique_filename: true
    });

    const document = await Document.create({
      name: name || req.file.originalname,
      description,
      fileType: req.file.mimetype,
      fileExtension: ext,
      owner: req.user._id,
      category: category || 'other',
      sharedWith: sharedWith ? JSON.parse(sharedWith) : [],
      requiresSignature: requiresSignature === 'true',
      signatureRequestedFrom: signatureRequestedFrom ? JSON.parse(signatureRequestedFrom) : [],
      currentVersion: 1,
      versions: [{
        version: 1,
        fileUrl: result.secure_url,
        publicId: result.public_id,
        uploadedBy: req.user._id,
        fileSize: req.file.size
      }]
    });

    // Notify people it was shared with
    if (document.sharedWith?.length) {
      for (const userId of document.sharedWith) {
        await createNotification({
          recipient: userId,
          type: 'document_shared',
          title: 'Document Shared With You',
          message: `${req.user.name} shared "${document.name}" with you.`,
          actionUrl: `/documents/${document._id}`,
          relatedId: document._id.toString()
        });
      }
    }

    // Notify signature requests
    if (document.signatureRequestedFrom?.length) {
      for (const userId of document.signatureRequestedFrom) {
        await createNotification({
          recipient: userId,
          type: 'signature_requested',
          title: 'Signature Required',
          message: `${req.user.name} is requesting your signature on "${document.name}".`,
          actionUrl: `/documents/${document._id}`,
          relatedId: document._id.toString()
        });
      }
    }

    const populated = await document.populate('owner', 'name avatarUrl');
    res.status(201).json({ success: true, document: populated });
  } catch (error) {
    next(error);
  }
};

// ─── Get documents for current user ──────────────────────────────────────────
exports.getMyDocuments = async (req, res, next) => {
  try {
    const { category, status, search } = req.query;
    const query = {
      $or: [{ owner: req.user._id }, { sharedWith: req.user._id }],
      isDeleted: false
    };
    if (category) query.category = category;
    if (status) query.status = status;
    if (search) query.name = { $regex: search, $options: 'i' };

    const documents = await Document.find(query)
      .populate('owner', 'name avatarUrl')
      .populate('sharedWith', 'name avatarUrl')
      .populate('signatures.user', 'name avatarUrl')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, documents });
  } catch (error) {
    next(error);
  }
};

// ─── Get single document ──────────────────────────────────────────────────────
exports.getDocument = async (req, res, next) => {
  try {
    const document = await Document.findById(req.params.id)
      .populate('owner', 'name avatarUrl email')
      .populate('sharedWith', 'name avatarUrl')
      .populate('signatures.user', 'name avatarUrl')
      .populate('signatureRequestedFrom', 'name avatarUrl');

    if (!document || document.isDeleted) {
      return res.status(404).json({ success: false, message: 'Document not found.' });
    }

    const isOwner = document.owner._id.equals(req.user._id);
    const isShared = document.sharedWith.some(u => u._id.equals(req.user._id));
    const isSignatureRequested = document.signatureRequestedFrom.some(u => u._id.equals(req.user._id));

    if (!isOwner && !isShared && !document.isPublic && !isSignatureRequested) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    // Get the current version file URL
    const currentVersionData = document.versions.find(v => v.version === document.currentVersion);
    const fileUrl = currentVersionData?.fileUrl;

    res.status(200).json({ success: true, document, fileUrl });
  } catch (error) {
    next(error);
  }
};

// ─── Upload new version ───────────────────────────────────────────────────────
exports.uploadNewVersion = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });

    const document = await Document.findById(req.params.id);
    if (!document || document.isDeleted) {
      return res.status(404).json({ success: false, message: 'Document not found.' });
    }
    if (!document.owner.equals(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only the owner can upload new versions.' });
    }

    const result = await uploadToCloudinary(req.file.buffer, {
      folder: 'nexus/documents',
      resource_type: 'auto'
    });

    document.currentVersion += 1;
    document.versions.push({
      version: document.currentVersion,
      fileUrl: result.secure_url,
      publicId: result.public_id,
      uploadedBy: req.user._id,
      fileSize: req.file.size,
      changeNote: req.body.changeNote
    });
    document.status = 'draft'; // reset status on new version

    await document.save();
    res.status(200).json({ success: true, message: 'New version uploaded.', document });
  } catch (error) {
    next(error);
  }
};

// ─── Sign Document ────────────────────────────────────────────────────────────
exports.signDocument = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Signature image required.' });

    const document = await Document.findById(req.params.id)
      .populate('owner', 'name email');
    if (!document || document.isDeleted) {
      return res.status(404).json({ success: false, message: 'Document not found.' });
    }

    // Check if user already signed
    const alreadySigned = document.signatures.some(s => s.user.equals(req.user._id));
    if (alreadySigned) {
      return res.status(400).json({ success: false, message: 'You have already signed this document.' });
    }

    // Upload signature image
    const result = await uploadToCloudinary(req.file.buffer, {
      folder: 'nexus/signatures',
      resource_type: 'image'
    });

    document.signatures.push({
      user: req.user._id,
      signatureImageUrl: result.secure_url,
      ipAddress: req.ip
    });

    // Check if all requested signatories have signed
    const allSigned = document.signatureRequestedFrom.every(userId =>
      document.signatures.some(s => s.user.equals(userId))
    );
    if (allSigned) document.status = 'signed';

    await document.save();

    // Notify owner
    await createNotification({
      recipient: document.owner._id,
      type: 'document_signed',
      title: 'Document Signed',
      message: `${req.user.name} signed "${document.name}".`,
      actionUrl: `/documents/${document._id}`,
      relatedId: document._id.toString()
    });

    res.status(200).json({ success: true, message: 'Document signed successfully.', document });
  } catch (error) {
    next(error);
  }
};

// ─── Share Document ───────────────────────────────────────────────────────────
exports.shareDocument = async (req, res, next) => {
  try {
    const { userIds } = req.body;
    const document = await Document.findById(req.params.id);
    if (!document) return res.status(404).json({ success: false, message: 'Document not found.' });
    if (!document.owner.equals(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only the owner can share this document.' });
    }

    // Add new user IDs without duplicates
    const newIds = userIds.filter(id => !document.sharedWith.includes(id));
    document.sharedWith.push(...newIds);
    await document.save();

    for (const userId of newIds) {
      await createNotification({
        recipient: userId,
        type: 'document_shared',
        title: 'Document Shared With You',
        message: `${req.user.name} shared "${document.name}" with you.`,
        actionUrl: `/documents/${document._id}`,
        relatedId: document._id.toString()
      });
    }

    res.status(200).json({ success: true, message: 'Document shared.', document });
  } catch (error) {
    next(error);
  }
};

// ─── Delete Document ──────────────────────────────────────────────────────────
exports.deleteDocument = async (req, res, next) => {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) return res.status(404).json({ success: false, message: 'Document not found.' });
    if (!document.owner.equals(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only the owner can delete this document.' });
    }

    document.isDeleted = true;
    await document.save();
    res.status(200).json({ success: true, message: 'Document deleted.' });
  } catch (error) {
    next(error);
  }
};
